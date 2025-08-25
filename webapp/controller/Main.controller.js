sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/Dialog",
    "sap/m/Label",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/Switch",
    "sap/m/MessageBox",
    "sap/ui/comp/smartvariants/PersonalizableInfo",
    "sap/ui/core/BusyIndicator",
    "com/xcaret/recepcionarticulosoff/model/indexedDBService",
    "com/xcaret/recepcionarticulosoff/utils/Services"
], (Controller, Dialog, Label, Button, Input, Switch, MessageBox, PersonalizableInfo, BusyIndicator, indexedDBService, Services) => {
    "use strict";
    var vInitialDate, vFinalDate, currentDate = new Date();
    let sUserID = "DEFAULT_USER", sFName, sLName, sEmail;
    var bURL;
    let host = "https://experiencias-xcaret-parques-s-a-p-i-de-c-v--xc-btpdev-15aca4ac6.cfapps.us10-001.hana.ondemand.com";
    let aIdEBELN = [], aIdPSPNR = [], aIdCONTRA = [], aIdUSER = [];
    var oSkip = 0, oTop = 10;
    var sSelectedTab = "All";
    return Controller.extend("com.xcaret.recepcionarticulosoff.controller.Main", {
        onInit: function () {

            var sHost = window.location.hostname;

            if (sHost.includes("btpdev")) {
                host = "https://experiencias-xcaret-parques-s-a-p-i-de-c-v--xc-btpdev-15aca4ac6.cfapps.us10-001.hana.ondemand.com";
            } else if (sHost.includes("qas-btp")) {
                host = "https://node.cfapps.us10-001.hana.ondemand.com";
            } else if (sHost.includes("prd") || sHost.includes("prod")) {
                host = "https://node-api-prd.cfapps.us10-001.hana.ondemand.com";
            } else if (sHost.includes("-workspaces-")) {
                host = "https://experiencias-xcaret-parques-s-a-p-i-de-c-v--xc-btpdev-15aca4ac6.cfapps.us10-001.hana.ondemand.com";
            }

            this.getCurrentUserName();
            this.onPutUserInformation();
            this.onCalculateDatesBefore(60);
            let oModel = new sap.ui.model.json.JSONModel();
            this.getView().setModel(oModel, "serviceModel");

            // --- GESTIÓN DE SESIONES: LIMPIEZA AL INICIAR LA VISTA PRINCIPAL ---
            // Mover la limpieza de sesiones a una función separada para evitar bloqueo
            this._cleanupUserSessions();

            this.multiQuery();

            this.oSmartVariantManagement = this.getView().byId("svm");
            this.currentVariantJson = "";
            this.oFilterBar = this.getView().byId("filterbar");
            let oPersInfo = new PersonalizableInfo({
                type: "filterBar",
                keyName: "persistencyKey",
                control: this.oFilterBar
            });
            this.oSmartVariantManagement.addPersonalizableControl(oPersInfo);
            this.oSmartVariantManagement.initialise(this._onVariantLoad.bind(this), this.oFilterBar);
            this.oSmartVariantManagement.attachSelect(this._onVariantChange.bind(this));

            this.bIsLoading = false;
            this.iTotalItems = null;
            var oEventBus = sap.ui.getCore().getEventBus();
            sSelectedTab = "All";
            oEventBus.subscribe("MainChannel", "onInitialMainPage", this.onInitialMainPage, this);
            //this.onGetGeneralData();

            // Detectar conexión al iniciar
            this.bIsOnline = indexedDBService.isOnline();
            window.addEventListener("online", this._handleOnline.bind(this));
            window.addEventListener("offline", this._handleOffline.bind(this));

            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("Main").attachPatternMatched(this._onMainMatched, this);

            BusyIndicator.hide();
        },

        // Offline
        _handleOnline: function () {
            this.bIsOnline = true;
            // Aquí podrías sincronizar datos pendientes si lo deseas
            sap.m.MessageToast.show("Conectado. Sincronizando datos...");
            // indexedDBService.syncPendingOps(processFn);
            this.syncPendingOps();
            this.syncPendingImages();
            this.syncPendingSignatures();
        },

        // Offline
        _handleOffline: function () {
            this.bIsOnline = false;
            sap.m.MessageToast.show("Sin conexión. Trabajando en modo offline.");
        },
        // Offline
        syncPendingOps: async function () {
            sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], async function (indexedDBService) {
                let pendingOps = await indexedDBService.getPendingOps();
                let successCount = 0, errorCount = 0;

                for (let op of pendingOps) {
                    try {
                        if (op.opType === "create" || op.opType === "update") {
                            let url = host + `/MaterialDocument`;
                            if (op.opType === "update" && op.id) {
                                url += "/" + op.id;
                            }
                            let response = await fetch(url, {
                                method: op.opType === "create" ? "POST" : "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(op.data)
                            });
                            let responseData = await response.json();
                            if (response.ok && responseData) {
                                await indexedDBService.deletePendingOp(op.id);
                                successCount++;
                            } else {
                                errorCount++;
                                console.error("Error al sincronizar pendiente:", responseData);
                            }
                        }
                    } catch (err) {
                        errorCount++;
                        console.error("Error al sincronizar pendiente:", err);
                    }
                }

                // Muestra un resumen al usuario
                if (successCount || errorCount) {
                    let msg = `Sincronización finalizada. ${successCount} exitosas, ${errorCount} con error.`;
                    sap.m.MessageToast.show(msg);
                }
            });
        },

        // Offline
        /**
        * Sincroniza imágenes pendientes guardadas en IndexedDB (tabla Images) cuando vuelves a estar online.
        * Sube cada imagen con pending: true al backend y, si es exitoso, la marca como sincronizada o la elimina.
        */
        syncPendingImages: async function () {
            sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], async function (indexedDBService) {
                // 1. Obtener imágenes pendientes en IndexedDB
                let pendingImages = await indexedDBService.getPendingImages(); // Solo pending: true
                if (!pendingImages || pendingImages.length === 0) {
                    sap.m.MessageToast.show("No hay imágenes pendientes por sincronizar.");
                    return;
                }

                let successCount = 0, errorCount = 0;
                for (let img of pendingImages) {
                    try {
                        // 2. Convierte base64 a Blob
                        let byteString = atob(img.data);
                        let ab = new ArrayBuffer(byteString.length);
                        let ia = new Uint8Array(ab);
                        for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i);
                        }
                        let blob = new Blob([ab], { type: img.mimeType });

                        // 3. Asegúrate que el campo INDEX esté presente
                        let indexValue = img.index !== undefined ? img.index : img.INDEX;
                        if (indexValue === undefined) {
                            console.warn("Imagen pendiente sin INDEX, saltando:", img);
                            errorCount++;
                            continue;
                        }

                        // 4. Arma FormData igual que en onUploadPhotos (ahora INCLUYENDO INDEX)
                        let formData = new FormData();
                        formData.append("image", blob, img.IMAGE_NAME);
                        formData.append("metadata", JSON.stringify([{
                            MBLRN: img.MBLRN,
                            LINE_ID: img.LINE_ID,
                            INDEX: indexValue,
                            IMAGE_NAME: img.IMAGE_NAME
                        }]));

                        // 5. Sube la imagen al backend
                        let response = await fetch(host + "/ImageMaterialReceptionItem", {
                            method: "POST",
                            body: formData
                        });

                        if (response.ok) {
                            await indexedDBService.markImageAsSynced(img.id || img.IMAGE_NAME);
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } catch (err) {
                        errorCount++;
                    }
                }

                sap.m.MessageToast.show(`Sincronización de imágenes finalizada. ${successCount} exitosas, ${errorCount} con error.`);
            });
        },

        /**
        * Sincroniza firmas pendientes guardadas en IndexedDB (store Signatures y PendingOps) cuando vuelves a estar online.
        * Sube cada firma con pending: true al backend y/o elimina en backend si es tipo delete.
        */
        /*
         syncPendingSignatures: async function () {
             sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], async function (indexedDBService) {
                 let pendingOps = await indexedDBService.getPendingOps();
                 // Filtra solo operaciones de firmas
                 let signatureOps = pendingOps.filter(op => op.type === "Signature");
                 if (!signatureOps || signatureOps.length === 0) {
                     sap.m.MessageToast.show("No hay firmas pendientes por sincronizar.");
                     return;
                 }
 
                 let successCount = 0, errorCount = 0;
 
                 for (let op of signatureOps) {
                     try {
                         if (op.opType === "create") {
                             // 1. Convierte base64 a Blob
                             let sign = op.data;
                             let byteString = atob(sign.image);
                             let ab = new ArrayBuffer(byteString.length);
                             let ia = new Uint8Array(ab);
                             for (let i = 0; i < byteString.length; i++) {
                                 ia[i] = byteString.charCodeAt(i);
                             }
                             let blob = new Blob([ab], { type: sign.mimeType || "image/jpeg" });
 
                             // 2. Arma FormData igual que uploadSignature
                             let formData = new FormData();
                             formData.append("image", blob, "signature.jpeg");
                             formData.append("metadata", JSON.stringify([{
                                 DOCID: sign.DOCID,
                                 ID: sign.ID,
                                 PROCESS: sign.PROCESS,
                                 SUBPROCESS: sign.SUBPROCESS
                             }]));
 
                             // 3. Sube la firma al backend
                             let response = await fetch(host + "/ImageSignItem", {
                                 method: "POST",
                                 body: formData
                             });
 
                             if (response.ok) {
                                 // Marca como sincronizada y elimina de pendientes
                                 await indexedDBService.markSignatureAsSynced(sign.id);
                                 await indexedDBService.deletePendingOp(op.id);
                                 successCount++;
                             } else {
                                 errorCount++;
                             }
                         } else if (op.opType === "delete") {
                             // 1. Elimina la firma en backend
                             let delItem = op.data;
                             let res = await fetch(host + "/ImageSignItem", {
                                 method: "DELETE",
                                 headers: { "Content-Type": "application/json" },
                                 body: JSON.stringify([{
                                     DOCID: delItem.DOCID,
                                     ID: delItem.ID,
                                     PROCESS: delItem.PROCESS,
                                     SUBPROCESS: delItem.SUBPROCESS
                                 }])
                             });
                             if (res.ok) {
                                 await indexedDBService.deletePendingOp(op.id);
                                 // También podrías eliminarla localmente si no lo has hecho antes
                                 await indexedDBService.deleteSignature(delItem.DOCID + "_" + delItem.ID + "_" + sEmail);
                                 successCount++;
                             } else {
                                 errorCount++;
                             }
                         }
                     } catch (err) {
                         errorCount++;
                         console.error("Error al sincronizar firma pendiente:", err);
                     }
                 }
 
                 sap.m.MessageToast.show(`Sincronización de firmas finalizada. ${successCount} exitosas, ${errorCount} con error.`);
             });
         },
         */
        syncPendingSignatures: async function () {
            sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], async function (indexedDBService) {
                let pendingOps = await indexedDBService.getPendingOps();
                // Filtra solo operaciones de firmas
                let signatureOps = pendingOps.filter(op => op.type === "Signature");
                if (!signatureOps || signatureOps.length === 0) {
                    sap.m.MessageToast.show("No hay firmas pendientes por sincronizar.");
                    return;
                }

                let successCount = 0, errorCount = 0;

                for (let op of signatureOps) {
                    try {
                        if (op.opType === "create") {
                            // 1. Convierte base64 a Blob
                            let sign = op.data;
                            // Construye el id igual que en saveSignature
                            const signatureId = sign.id || (sign.DOCID + "_" + sign.ID + "_" + sign.EMAIL);
                            if (!signatureId || signatureId.includes("undefined")) {
                                console.error("ID de firma para sincronizar inválido:", sign);
                                errorCount++;
                                continue; // Salta este elemento
                            }
                            let byteString = atob(sign.image);
                            let ab = new ArrayBuffer(byteString.length);
                            let ia = new Uint8Array(ab);
                            for (let i = 0; i < byteString.length; i++) {
                                ia[i] = byteString.charCodeAt(i);
                            }
                            let blob = new Blob([ab], { type: sign.mimeType || "image/jpeg" });

                            // 2. Arma FormData igual que uploadSignature
                            let formData = new FormData();
                            formData.append("image", blob, "signature.jpeg");
                            formData.append("metadata", JSON.stringify([{
                                DOCID: sign.DOCID,
                                ID: sign.ID,
                                PROCESS: sign.PROCESS,
                                SUBPROCESS: sign.SUBPROCESS
                            }]));

                            // 3. Sube la firma al backend
                            let response = await fetch(host + "/ImageSignItem", {
                                method: "POST",
                                body: formData
                            });

                            if (response.ok) {
                                // Marca como sincronizada y elimina de pendientes
                                await indexedDBService.markSignatureAsSynced(signatureId);
                                await indexedDBService.deletePendingOp(op.id);
                                successCount++;
                            } else {
                                errorCount++;
                            }
                        } else if (op.opType === "delete") {
                            // 1. Elimina la firma en backend
                            let delItem = op.data;
                            let signatureId = (delItem.DOCID + "_" + delItem.ID + "_" + sEmail);
                            let res = await fetch(host + "/ImageSignItem", {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify([{
                                    DOCID: delItem.DOCID,
                                    ID: delItem.ID,
                                    PROCESS: delItem.PROCESS,
                                    SUBPROCESS: delItem.SUBPROCESS
                                }])
                            });
                            if (res.ok) {
                                await indexedDBService.deletePendingOp(op.id);
                                // También podrías eliminarla localmente si no lo has hecho antes
                                await indexedDBService.deleteSignature(signatureId);
                                successCount++;
                            } else {
                                errorCount++;
                            }
                        }
                    } catch (err) {
                        errorCount++;
                        console.error("Error al sincronizar firma pendiente:", err);
                    }
                }

                sap.m.MessageToast.show(`Sincronización de firmas finalizada. ${successCount} exitosas, ${errorCount} con error.`);
            });
        },

        onCalculateDatesBefore: function (days) {
            let vCurrentDate = currentDate.toISOString().split("T")[0];
            var oFinalDate = new Date(vCurrentDate);
            oFinalDate.setDate(oFinalDate.getDate() - 60);
            vFinalDate = vCurrentDate;
            vInitialDate = oFinalDate.toISOString().split("T")[0];
            var oDateRange = this.byId("idCreationDateRange");
            oDateRange.setDateValue(oFinalDate);
            oDateRange.setSecondDateValue(currentDate);
        },

        onDateRangeChange: function (oEvent) {
            var oDateRange = oEvent.getSource();
            var aDates = oDateRange.getDateValue(); // Get selected start date
            var oStartDate = oDateRange.getDateValue();
            var oEndDate = oDateRange.getSecondDateValue();
            if (oStartDate !== null) {
                vInitialDate = oStartDate.toISOString().split("T")[0];
            } else {
                vInitialDate = null;
            }
            if (oEndDate !== null) {
                vFinalDate = oEndDate.toISOString().split("T")[0];
            } else {
                vFinalDate = null;
            }
        },

        onInitialMainPage: async function () {
            try {
                const deleteResult = await Services.DeleteAllSessions();
                if (deleteResult && deleteResult !== "Error") {
                    console.log("✅ Sesiones inactivas limpiadas exitosamente");
                } else {
                    console.warn("⚠️ Advertencia al limpiar sesiones inactivas:", deleteResult);
                }
            } catch (e) {
                console.error("❌ Error limpiando sesiones inactivas:", e);
            }

            BusyIndicator.hide();
            oSkip = 0;
            this.iTotalItems = null;
            this.bIsLoading = false;
            let oModel = this.getView().getModel("serviceModel");
            oModel.setProperty("/generalData", []);
            this.onGetGeneralData();
        },

        onUpdateStarted: function (oEvent) {
            const oTable = this.byId("progrAlmacenTable");
            const iDisplayedItems = oTable.getItems().length;
            const sReason = oEvent.getParameter("reason");
            if (sReason === "Growing" && !this.bIsLoading && (this.iTotalItems === null || oSkip + oTop <= this.iTotalItems)) {
                this.bIsLoading = true;
                oSkip += oTop;
                this.onGetGeneralData(true); // Obtener más datos
            }
        },

        getCurrentUserName: function () {
            if (sap.ushell && sap.ushell.Container) {
                const oUser = sap.ushell.Container.getUser();
                sUserID = oUser.getId();
                sFName = oUser.getFirstName();
                sLName = oUser.getLastName();
                sEmail = oUser.getEmail();
            } else {


                /*
                sUserID = '53d6512a-591a-4961-a37f-0c670af2cb00';
                sFName = 'Eric Alejandro';
                sLName = 'Medina';
                sEmail = 'eric.medina@celeritech.biz';
                */

                //only test -- jc -- borrar al deployar
            }
        },

        onPutUserInformation: function (oEvent) {
            try {
                const sBaseUrl = host + "/User/" + sUserID;
                var xhr = new XMLHttpRequest();
                // Open the request (synchronous)
                xhr.open("PUT", sBaseUrl, false);  // false means synchronous request
                xhr.setRequestHeader("Content-Type", "application/json");
                var data = JSON.stringify({
                    NAME: sFName,
                    LNAME: sLName,
                    EMAIL: sEmail
                });
                // Send the request
                xhr.send(data);

                // Process the response after the request completes
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    console.log("Success:", response);
                } else {
                    console.error("Error:", xhr.status, xhr.statusText);
                }
            } catch (error) {
                console.error("Request failed:", error);
            }
        },
        // Initial Get Data ######################### Read----- #########################
        //
        buildNewQueryUrl: function (base, aIdEBELN, aIdPSPNR, aIdCONTRA, aIdUSER) {
            let conditions = [];

            // Función auxiliar para construir OR con un mismo parámetro
            function addCondition(field, values) {
                if (values && values.length > 0) {
                    let condition = values.map(value => `${field} EQ '${value}'`).join(" OR ");
                    conditions.push(`${condition}`); // Agrupa con paréntesis
                }
            }

            addCondition("EBELN", aIdEBELN);
            addCondition("ID_PEP", aIdPSPNR);
            addCondition("ID_CON", aIdCONTRA);
            //addCondition("ERNAM", aIdUSER);
            addCondition("RESP", aIdUSER);

            // Une todas las condiciones con AND
            let query = conditions.join(" AND ");

            // Retorna la URL final
            return query ? `${base}${query}` : base;
        },

        createUrl: function () {
            const sBaseUrl = `${host}/ScheduleLine?$filter=`;
            let sUrl = sBaseUrl;

            var sFinalUrl = this.buildNewQueryUrl(sBaseUrl, aIdEBELN, aIdPSPNR, aIdCONTRA, aIdUSER);
            // Regex to remove parameters with "undefined" as the value
            sUrl = sFinalUrl.replace(/([&?])([^&=]+)=undefined/g, '$1');
            // Remove trailing '&' or '?' if no parameters remain
            sUrl = sUrl.replace(/[?&]$/, '');

            return sUrl;
        },
        //#region Integration Services
        // Query

        _getBaseURL() {
            let appId = this.getOwnerComponent().getManifestEntry("/sap.app/id"),
                appPath = appId.replaceAll(".", "/"),
                appModulePath = jQuery.sap.getModulePath(appPath)
            return appModulePath;
        },

        onIconTabFilterSelect: function (oEvent) {
            sSelectedTab = oEvent.getParameter("selectedKey");
            this.onInitialMainPage();
        },
        /*
        onGetGeneralData: async function (bAppend = false) {
            try {
                let url;
                let sTop = "";
                const oController = this;
                var bFilter = false;
                var sDates = "";

                if ([aIdEBELN, aIdPSPNR, aIdCONTRA, aIdUSER].every(val => val?.length === 0)) {
                    url = `${host}/ScheduleLine`;
                } else {
                    url = this.createUrl();
                    bFilter = true;
                }

                if (sSelectedTab !== "All") {
                    var sTabInd = this._getFilterTabIndicator(sSelectedTab);
                    if (bFilter) {
                        url = url + " AND RE_TYPE EQ '1'";
                    } else {
                        url = url + "?$filter=RE_TYPE EQ '1'";
                    }
                    url = url + "&$virtualFilter=GENERAL_STATUS EQ '" + sTabInd + "'";
                    bFilter = true;
                } else {
                    if (bFilter) {
                        url = url + " AND RE_TYPE EQ '1'";
                    } else {
                        url = url + "?$filter=RE_TYPE EQ '1'";
                        bFilter = true;
                    }
                }


                if ((oTop !== "" || oTop !== undefined) && (oSkip !== "" || oSkip !== undefined)) {
                    sTop = "$top=" + oTop + "&$skip=" + oSkip;
                }

                if (vInitialDate && vFinalDate) {
                    sDates = "(CREATED_AT BETWEEN '" + vInitialDate + "' AND '" + vFinalDate + "')"
                }

                if (bFilter && sDates) {
                    url = url + " AND " + sDates;
                } else {
                    if (sDates) {
                        url = url + "?$filter=" + sDates;
                        bFilter = true;
                    }
                }

                if (sTop) {
                    if (bFilter) {
                        url = url + "&" + sTop;
                    } else {
                        url = url + "?" + sTop;
                    }
                }

                let response = await fetch(url, { method: "GET" });
                if (!response.ok) throw new Error(`${response.error}`);
                let responseData = await response.json();
                let oModel = this.getView().getModel("serviceModel");

                if (response.status === 200) {
                    if (responseData.error === undefined) {
                        if (oController.iTotalItems === null) {
                            oController.iTotalItems = responseData.result.length;
                        } else {
                            oController.iTotalItems = oController.iTotalItems + responseData.result.length;
                        }
                        const aCurrentData = oModel.getProperty("/generalData") || [];
                        const aUpdatedData = bAppend ? aCurrentData.concat(responseData.result) : responseData.result;
                        this.onUpdateFinishedTable(aUpdatedData.length);
                        oModel.setProperty("/generalData", this._getFormatData(aUpdatedData));
                        oController.bIsLoading = false;
                    } else {
                        const aDataResult = [];
                        this.onUpdateFinishedTable(aDataResult.length);
                        oModel.setProperty("/generalData", aDataResult);
                        oController.iTotalItems = aDataResult.length;
                        oController.bIsLoading = false;
                        sap.m.MessageToast.show(responseData.error);
                    }
                }
            } catch (error) {
                console.error(error);
            }
        },
        */
        // Offline

        onGetGeneralData: async function (bAppend = false) {
            try {
                let oModel = this.getView().getModel("serviceModel");
                if (indexedDBService.isOnline()) {
                    // Modo Online: obtener del backend y guardar en IndexDB
                    let url;
                    let sTop = "";
                    var bFilter = false;
                    var sDates = "";

                    if ([aIdEBELN, aIdPSPNR, aIdCONTRA, aIdUSER].every(val => val?.length === 0)) {
                        url = `${host}/ScheduleLine`;
                    } else {
                        url = this.createUrl();
                        bFilter = true;
                    }

                    if (sSelectedTab !== "All") {
                        var sTabInd = this._getFilterTabIndicator(sSelectedTab);
                        if (bFilter) {
                            url = url + " AND RE_TYPE EQ '1'";
                        } else {
                            url = url + "?$filter=RE_TYPE EQ '1'";
                        }
                        url = url + "&$virtualFilter=GENERAL_STATUS EQ '" + sTabInd + "'";
                        bFilter = true;
                    } else {
                        if (bFilter) {
                            url = url + " AND RE_TYPE EQ '1'";
                        } else {
                            url = url + "?$filter=RE_TYPE EQ '1'";
                            bFilter = true;
                        }
                    }

                    if ((oTop !== "" || oTop !== undefined) && (oSkip !== "" || oSkip !== undefined)) {
                        sTop = "$top=" + oTop + "&$skip=" + oSkip;
                    }

                    if (vInitialDate && vFinalDate) {
                        sDates = "(CREATED_AT BETWEEN '" + vInitialDate + "' AND '" + vFinalDate + "')"
                    }

                    if (bFilter && sDates) {
                        url = url + " AND " + sDates;
                    } else {
                        if (sDates) {
                            url = url + "?$filter=" + sDates;
                            bFilter = true;
                        }
                    }

                    if (sTop) {
                        if (bFilter) {
                            url = url + "&" + sTop;
                        } else {
                            url = url + "?" + sTop;
                        }
                    }

                    let response = await fetch(url, { method: "GET" });
                    if (!response.ok) throw new Error(`${response.error}`);
                    let responseData = await response.json();

                    if (response.status === 200) {
                        if (responseData.error === undefined) {
                            // Asegúrate de usar el payload con id
                            const payload = responseData.result.map(obj => ({
                                ...obj,
                                id: obj.EBELN   // usa la clave primaria del objeto como id
                            }));

                            // Guardar en IndexDB la data principal
                            await indexedDBService.saveBulk("ScheduleLine", payload);

                            // Precarga masiva de detalles de cada item
                            let maxItemsToPreload = 50; // Puedes ajustar este número
                            let itemsToPreload = responseData.result.slice(0, maxItemsToPreload);
                            let detailsToSave = [];
                            for (const item of itemsToPreload) {
                                try {
                                    let ebeln = item.EBELN;
                                    let detailUrl = `${host}/ScheduleLine/${ebeln}`;
                                    let detailResponse = await fetch(detailUrl, { method: "GET" });
                                    let detailData = await detailResponse.json();
                                    // Guarda el detalle en IndexDB
                                    detailsToSave.push({ id: ebeln, ...detailData.response });
                                } catch (err) {
                                    // Si falla, continúa con el siguiente
                                    console.warn(`No se pudo precargar el detalle para EBELN ${item.EBELN}:`, err);
                                }
                            }
                            // Guardar todos los detalles en IndexDB
                            if (detailsToSave.length > 0) {
                                await indexedDBService.saveBulk("ScheduleLineDetail", detailsToSave);
                            }
                            // Fin precarga masiva

                            // Actualiza la UI
                            if (this.iTotalItems === null) {
                                this.iTotalItems = responseData.result.length;
                            } else {
                                this.iTotalItems = this.iTotalItems + responseData.result.length;
                            }
                            const aCurrentData = oModel.getProperty("/generalData") || [];
                            const aUpdatedData = bAppend ? aCurrentData.concat(responseData.result) : responseData.result;
                            this.onUpdateFinishedTable(aUpdatedData.length);
                            oModel.setProperty("/generalData", this._getFormatData(aUpdatedData));
                            this.bIsLoading = false;
                        } else {
                            const aDataResult = [];
                            this.onUpdateFinishedTable(aDataResult.length);
                            oModel.setProperty("/generalData", aDataResult);
                            this.iTotalItems = aDataResult.length;
                            this.bIsLoading = false;
                            sap.m.MessageToast.show(responseData.error);
                        }
                    }
                } else {
                    // Modo Offline: cargar desde IndexDB
                    let localData = await indexedDBService.getAll("ScheduleLine");
                    oModel.setProperty("/generalData", this._getFormatData(localData));
                    this.onUpdateFinishedTable(localData.length);
                    this.bIsLoading = false;
                    sap.m.MessageToast.show("Datos cargados en modo offline");
                }
            } catch (error) {
                console.error(error);
            }
        },

        /*
        onGetGeneralData: async function (bAppend = false) {
            try {
                let oModel = this.getView().getModel("serviceModel");
                // ----------- ONLINE MODE ----------
                if (indexedDBService.isOnline()) {
                    let url;
                    let sTop = "";
                    var bFilter = false;
                    var sDates = "";
        
                    if ([aIdEBELN, aIdPSPNR, aIdCONTRA, aIdUSER].every(val => val?.length === 0)) {
                        url = `${host}/ScheduleLine`;
                    } else {
                        url = this.createUrl();
                        bFilter = true;
                    }
        
                    if (sSelectedTab !== "All") {
                        var sTabInd = this._getFilterTabIndicator(sSelectedTab);
                        if (bFilter) {
                            url = url + " AND RE_TYPE EQ '1'";
                        } else {
                            url = url + "?$filter=RE_TYPE EQ '1'";
                        }
                        url = url + "&$virtualFilter=GENERAL_STATUS EQ '" + sTabInd + "'";
                        bFilter = true;
                    } else {
                        if (bFilter) {
                            url = url + " AND RE_TYPE EQ '1'";
                        } else {
                            url = url + "?$filter=RE_TYPE EQ '1'";
                            bFilter = true;
                        }
                    }
        
                    if ((oTop !== "" || oTop !== undefined) && (oSkip !== "" || oSkip !== undefined)) {
                        sTop = "$top=" + oTop + "&$skip=" + oSkip;
                    }
        
                    if (vInitialDate && vFinalDate) {
                        sDates = "(CREATED_AT BETWEEN '" + vInitialDate + "' AND '" + vFinalDate + "')"
                    }
        
                    if (bFilter && sDates) {
                        url = url + " AND " + sDates;
                    } else {
                        if (sDates) {
                            url = url + "?$filter=" + sDates;
                            bFilter = true;
                        }
                    }
        
                    if (sTop) {
                        if (bFilter) {
                            url = url + "&" + sTop;
                        } else {
                            url = url + "?" + sTop;
                        }
                    }
        
                    let response = await fetch(url, { method: "GET" });
                    if (!response.ok) throw new Error(`${response.error}`);
                    let responseData = await response.json();
        
                    if (response.status === 200) {
                        if (responseData.error === undefined) {
                            // ------- GUARDAR EN INDEXDB PRINCIPAL ------
                            const payload = responseData.result.map(obj => ({
                                ...obj,
                                id: obj.EBELN   // usa la clave primaria del objeto como id
                            }));
                            await indexedDBService.saveBulk("ScheduleLine", payload);
        
                            // ------- PRECARGA MASIVA DE DETALLE + IMÁGENES -------
                            let maxItemsToPreload = 50; // Puedes ajustar este número
                            let itemsToPreload = payload.slice(0, maxItemsToPreload);
                            let detailsToSave = [];
                            let imagesToSave = [];
        
                            for (const item of itemsToPreload) {
                                try {
                                    let ebeln = item.EBELN;
                                    let detailUrl = `${host}/ScheduleLine/${ebeln}`;
                                    let detailResponse = await fetch(detailUrl, { method: "GET" });
                                    let detailData = await detailResponse.json();
        
                                    detailsToSave.push({ id: ebeln, ...detailData.response });
        
                                    // ---- Precarga de imágenes asociadas ----
                                    if (detailData.response && detailData.response.MBLRN) {
                                        let mblnr = detailData.response.MBLRN;
                                        let imageUrl = `${host}/ImageMaterialReceptionItem/${mblnr}`;
                                        let imageResponse = await fetch(imageUrl, { method: "GET" });
                                        let imageData = await imageResponse.json();
        
                                        if (imageData.images && imageData.images.length > 0) {
                                            for (const img of imageData.images) {
                                                imagesToSave.push({
                                                    id: `${mblnr}_${img.LINE_ID}_${img.INDEX}`,
                                                    MBLRN: mblnr,
                                                    LINE_ID: img.LINE_ID,
                                                    INDEX: img.INDEX,
                                                    data: img.data, // base64
                                                    mimeType: img.mimeType,
                                                    IMAGE_NAME: img.IMAGE_NAME
                                                });
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.warn(`No se pudo precargar el detalle o imágenes para EBELN ${item.EBELN}:`, err);
                                }
                            }
        
                            // Guardar los detalles en IndexDB
                            if (detailsToSave.length > 0) {
                                await indexedDBService.saveBulk("ScheduleLineDetail", detailsToSave);
                            }
                            // Guardar las imágenes en IndexDB
                            if (imagesToSave.length > 0) {
                                await indexedDBService.saveBulk("Images", imagesToSave);
                            }
        
                            // ------- FIN PRECARGA MASIVA -----
        
                            // ------- ACTUALIZA LA UI -------
                            if (this.iTotalItems === null) {
                                this.iTotalItems = responseData.result.length;
                            } else {
                                this.iTotalItems = this.iTotalItems + responseData.result.length;
                            }
                            const aCurrentData = oModel.getProperty("/generalData") || [];
                            const aUpdatedData = bAppend ? aCurrentData.concat(responseData.result) : responseData.result;
                            this.onUpdateFinishedTable(aUpdatedData.length);
                            oModel.setProperty("/generalData", this._getFormatData(aUpdatedData));
                            this.bIsLoading = false;
                        } else {
                            const aDataResult = [];
                            this.onUpdateFinishedTable(aDataResult.length);
                            oModel.setProperty("/generalData", aDataResult);
                            this.iTotalItems = aDataResult.length;
                            this.bIsLoading = false;
                            sap.m.MessageToast.show(responseData.error);
                        }
                    }
                // ----------- OFFLINE MODE ----------
                } else {
                    let localData = await indexedDBService.getAll("ScheduleLine");
                    oModel.setProperty("/generalData", this._getFormatData(localData));
                    this.onUpdateFinishedTable(localData.length);
                    this.bIsLoading = false;
                    sap.m.MessageToast.show("Datos cargados en modo offline");
                }
            } catch (error) {
                console.error(error);
            }
        },
        */
        // Offline
        /**
         * Precarga masiva de detalles de cada item ScheduleLine después de cargar la tabla principal
         * Guarda cada detalle en el Store "ScheduleLineDetail" con clave id = EBELN
         */
        /*
        preloadScheduleLineDetails: async function (aScheduleLines, indexedDBService) {
            // Si el volumen es alto, puedes limitar el número de detalles a precargar
            let maxItemsToPreload = 50; // Cambia este número según tu límite
            let itemsToPreload = aScheduleLines.slice(0, maxItemsToPreload);

            // Array para guardar detalles
            let detailsToSave = [];

            for (const item of itemsToPreload) {
                try {
                    let ebeln = item.EBELN;
                    let detailUrl = `${host}/ScheduleLine/${ebeln}`;
                    let detailResponse = await fetch(detailUrl, { method: "GET" });
                    let detailData = await detailResponse.json();
                    // Guarda en IndexDB (la clave debe ser la misma que uses para recuperar, aquí EBELN)
                    detailsToSave.push({ id: ebeln, ...detailData.response });
                } catch (err) {
                    // Si falla, continúa con el siguiente
                    console.warn(`No se pudo precargar el detalle para EBELN ${item.EBELN}:`, err);
                }
            }

            if (detailsToSave.length > 0) {
                await indexedDBService.saveBulk("ScheduleLineDetail", detailsToSave);
            }
        },
        */

        /*
        _getFilterTabIndicator: function (sTab) {
            var sRet = "";
            switch (sTab) {
                case "Active":
                    sRet = "1";
                    break;
                case "Deleted":
                    sRet = "2";
                    break;
                case "Partial":
                    sRet = "3";
                    break;
                case "Total":
                    sRet = "4";
                    break;
                default:
                    break;
            }
            return sRet;
        },
        */

        //24.06.2025
        _getFilterTabIndicator: function (sTab) {
            var sRet = "";
            switch (sTab) {
                case "Active":
                    sRet = "0";
                    break;
                case "Deleted":
                    sRet = "3";
                    break;
                case "Partial":
                    sRet = "1";
                    break;
                case "Total":
                    sRet = "2";
                    break;
                default:
                    break;
            }
            return sRet;
        },

        _getFormatData: function (aData) {
            var that = this;
            aData.forEach(function (oItem) {
                //let iStat = parseInt(oItem.STATUS);
                let iStat = parseInt(oItem.GENERAL_STATUS); //24.06.2025
                let oObj = that._getStatusObj(iStat);
                oItem["STATUS_TEXT"] = oObj.STATUS_TEXT;
                oItem["STATUS_ICON"] = oObj.STATUS_ICON;
                oItem["STATUS_STATE"] = oObj.STATUS_STATE;
                var sDate = "";
                if (oItem.CREATED_AT) {
                    sDate = that.getStringDate(new Date(oItem.CREATED_AT));
                }
                oItem["CREATED_AT_DATE"] = sDate;
            });
            return aData;
        },

        getStringDate: function (oDate) {
            var day = String(oDate.getDate()).padStart(2, '0');
            var month = String(oDate.getMonth() + 1).padStart(2, '0'); // Los meses van de 0 a 11
            var year = oDate.getFullYear();
            return year + "-" + month + "-" + day;
        },

        /*
       _getStatusObj: function (iStat) {
           var i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
           var oObj = {
               STATUS_TEXT: "Unknown",
               STATUS_ICON: "",
               STATUS_STATE: "None"
           };
           switch (iStat) {
               case 1:
                   oObj.STATUS_TEXT = i18.getText("STATUS_ACTIVE");
                   oObj.STATUS_ICON = "sap-icon://sys-enter-2";
                   oObj.STATUS_STATE = "Success";
                   break;
               case 2:
                   oObj.STATUS_TEXT = i18.getText("STATUS_DELETED");
                   oObj.STATUS_ICON = "sap-icon://error";
                   oObj.STATUS_STATE = "Error";
                   break;
               case 3:
                   oObj.STATUS_TEXT = i18.getText("STATUS_PARTIAL");
                   oObj.STATUS_ICON = "sap-icon://alert";
                   oObj.STATUS_STATE = "Warning";
                   break;
               case 4:
                   oObj.STATUS_TEXT = i18.getText("STATUS_TOTAL");
                   oObj.STATUS_ICON = "sap-icon://information";
                   oObj.STATUS_STATE = "Information";
                   break;
               default:
                   break;
           }
           return oObj;
       },
       */


        //24.06.2025
        _getStatusObj: function (iStat) {
            var i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            var oObj = {
                STATUS_TEXT: "Unknown",
                STATUS_ICON: "",
                STATUS_STATE: "None"
            };
            switch (iStat) {
                case 0:
                    oObj.STATUS_TEXT = i18.getText("STATUS_ACTIVE");
                    oObj.STATUS_ICON = "sap-icon://sys-enter-2";
                    oObj.STATUS_STATE = "Success";
                    break;
                case 3:
                    oObj.STATUS_TEXT = i18.getText("STATUS_DELETED");
                    oObj.STATUS_ICON = "sap-icon://error";
                    oObj.STATUS_STATE = "Error";
                    break;
                case 1:
                    oObj.STATUS_TEXT = i18.getText("STATUS_PARTIAL");
                    oObj.STATUS_ICON = "sap-icon://alert";
                    oObj.STATUS_STATE = "Warning";
                    break;
                case 2:
                    oObj.STATUS_TEXT = i18.getText("STATUS_TOTAL");
                    oObj.STATUS_ICON = "sap-icon://information";
                    oObj.STATUS_STATE = "Information";
                    break;
                default:
                    break;
            }
            return oObj;
        },

        multiQuery: async function () {
            try {
                let urls = [
                    `${host}/Provider/query?BLOCKED=null`,
                    `${host}/User`,
                    `${host}/Rol?$filter=ID EQ 007 AND EMAIL EQ '${sEmail}'`,
                    `${host}/Projects/Project/query?&ID_STA=1`,
                    `${host}/Contract`

                ];

                let responses = await Promise.all(
                    urls.map(url => fetch(url).then(res => {
                        if (!res.ok) throw new Error(`Error fetching ${url}`);
                        return res.json();
                    }))
                );
                // Assuming each response has a `result` property
                let structuredData = {
                    scheduleLine: responses[0].data,
                    user: responses[1].result,
                    rol: responses[2].result,
                    projects: responses[3].data,
                    contract: responses[4].result
                };

                let oModel = this.getView().getModel("serviceModel");
                oModel.setProperty("/generalProvider", responses[0].data);
                oModel.setProperty("/generalUser", this._getUserCollection(responses[1].result));
                oModel.setProperty("/generalRol", responses[2].result);
                if ([responses[2].result].every(val => val?.length !== 0)) { this.validateRol(responses[2].result); }
                oModel.setProperty("/generalProjects", responses[3].data);
                oModel.setProperty("/generalContract", responses[4].result);
                this.showUserDialog();
            } catch (error) {
                console.error(error);
            }
        },

        showUserDialog: function () {
            this.byId("IdUSER").fireValueHelpRequest();
        },

        _getUserCollection: function (aData) {
            var aResult = [];
            aData.forEach(function (oItem) {
                var oItem = {
                    UserId: oItem.ERNAM,
                    UserText: oItem.NAME + " " + oItem.LNAME,
                    ERNAM: oItem.ERNAM,
                    NAME: oItem.NAME,
                    LNAME: oItem.LNAME,
                    EMAIL: oItem.EMAIL
                }
                aResult.push(oItem);
            });
            return aResult;
        },
        //
        // End Get Data ######################### Read----- #########################

        // Page Events ######################### ----- #########################
        // Page Header ######################### ----- #########################

        // Filters
        valueHelpFilter: function (oEvent) {
            let aData;
            const i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            // Get Model
            let oModel = this.getView().getModel("serviceModel");
            // Save MultiInput which executes the event
            this._oMultiInput = oEvent.getSource();

            // Get ID of MultiInput
            let id = oEvent.getSource().getId();
            let shortId = id.split("--").pop();
            let filterId, filterDescr, title, textAdded;

            if (id.includes("IdEBELN")) {
                filterId = "EBELN";
                filterDescr = "EBELN";
                aData = oModel.getProperty("/generalData") || [];
                title = i18.getText("EBELN");

            } else if (id.includes("IdPSPNR")) {
                filterId = "ID_PEP";
                filterDescr = "NAME1";
                aData = oModel.getProperty("/generalProjects") || [];
                title = i18.getText("PSPNR");

            } else if (id.includes("ID_CON")) {
                filterId = "ID_CON";
                filterDescr = "CONAM";
                aData = oModel.getProperty("/generalContract") || [];
                title = i18.getText("ID_CON");

            } else if (id.includes("IdUSER")) {
                filterId = "ERNAM";
                //filterDescr = "NAME";
                filterDescr = "UserText";
                aData = oModel.getProperty("/generalUser") || [];
                title = i18.getText("ERNAM");
            }

            // Get tokens of MultiInput
            let aTokens = this._oMultiInput.getTokens().map(token => ({
                key: token.getKey(),
                text: token.getText()
            }));


            let oTemplate;
            var bMultiSelect = true;
            if (id.includes("IdUSER")) {
                bMultiSelect = false;
                oTemplate = new sap.m.StandardListItem({
                    title: `{${filterDescr}}`
                });
            } else {
                oTemplate = new sap.m.StandardListItem({
                    title: `{${filterId}}`,
                    description: `{${filterDescr}}`
                })
            }

            // Creation of Dialog
            if (!this._oSelectDialog) {
                this._oSelectDialog = new sap.m.SelectDialog({
                    title: title,
                    multiSelect: bMultiSelect,
                    items: {
                        path: "/filters",
                        template: oTemplate
                    },
                    confirm: function (oEvent) { // Confirm Button
                        let selectedItems = oEvent.getParameter("selectedItems");
                        if (!selectedItems) return;
                        if (selectedItems.length == 0) { this._oMultiInput.removeAllTokens(); return; }
                        this._oMultiInput.removeAllTokens();
                        selectedItems.forEach(item => {

                            if (id.includes("IdUSER")) {
                                this._oMultiInput.removeAllTokens();
                                var oObj = item.getBindingContext().getObject()
                                let token = new sap.m.Token({
                                    key: oObj.UserId,
                                    text: oObj.UserText
                                });
                                this._oMultiInput.addToken(token);
                                textAdded = oObj.UserId;
                            } else {
                                let token = new sap.m.Token({
                                    key: item.getTitle(),
                                    text: item.getDescription()
                                });
                                this._oMultiInput.addToken(token);
                                textAdded = item.getTitle();
                            }

                            if (id.includes("IdEBELN")) {
                                aIdEBELN.push(textAdded);
                            } else if (id.includes("IdPSPNR")) {
                                aIdPSPNR.push(textAdded);
                            } else if (id.includes("ID_CON")) {
                                aIdEBELN.push(textAdded);
                            } else if (id.includes("IdUSER")) {
                                aIdUSER = [];
                                aIdUSER.push(textAdded);
                            }
                        });

                        this._oSelectDialog.destroy();
                        this._oSelectDialog = null;

                        if (id.includes("IdUSER")) {
                            this.onInitialMainPage();
                        }
                    }.bind(this),
                    search: function (oEvent) { // Search Event
                        let sValue = oEvent.getParameter("value");
                        let oFilter = new sap.ui.model.Filter(`${filterDescr}`, sap.ui.model.FilterOperator.Contains, sValue);
                        oEvent.getSource().getBinding("items").filter([oFilter]);
                    },
                    cancel: function (oEvent) { // Cancel Button
                        this._oSelectDialog.destroy();
                        this._oSelectDialog = null;
                    }.bind(this)
                });
                this.getView().addDependent(this._oSelectDialog);
            }
            // Set Items of Model
            let oTempModel = new sap.ui.model.json.JSONModel({ filters: aData });
            this._oSelectDialog.setModel(oTempModel);
            // Add previous tokens
            this._oSelectDialog.attachEventOnce("updateFinished", function () {
                let oList = this._oSelectDialog.getItems();
                oList.forEach(item => {
                    if (aTokens.includes(item.getTitle())) {
                        item.setSelected(true);
                    }
                });
            }.bind(this));
            this._oSelectDialog.open("");
        },

        onUpdateFinishedTable: function (iTotal) {
            let oModel = this.getView().getModel("serviceModel");
            oModel.setProperty("/titleCount", iTotal);
            oModel.refresh();
            this.byId("progrAlmacenTable").removeSelections(true);
            this._setIconTabCount(iTotal);
        },

        _setIconTabCount: function (iTotal) {
            var oIconTabBar = this.byId("iconTabBar");
            var aItems = oIconTabBar.getItems();

            //reset all counts
            aItems.forEach(function (oItem, iIndex, aList) {
                if (aList[iIndex].getId().includes("filter") && aList[iIndex].getKey() !== "All") {
                    oItem.setCount("");
                }
            });

            //Set total
            if (iTotal > 0) {
                aItems.forEach(function (oItem, iIndex, aList) {
                    if (aList[iIndex].getId().includes("filter") && aList[iIndex].getKey() !== "All") {
                        if (oItem.getKey() === sSelectedTab) {
                            oItem.setCount(iTotal);
                        }
                    }
                });
            }
        },

        updateTokenIdClear: function (oEvent) {
            var oSource = oEvent.getSource(); // The UI control that triggered the event
            let id = oEvent.getSource().getId();
            let shortId = id.split("--").pop();

            if (oEvent.getParameter("removedTokens")[0]) {
                var text = oEvent.getParameter("removedTokens")[0].getKey();        //getText();
                switch (shortId) {
                    case "IdEBELN":
                        aIdEBELN = aIdEBELN.filter(function (linea) {
                            return linea !== text;
                        });
                        break;
                    case "IdPSPNR":
                        aIdPSPNR = aIdPSPNR.filter(function (linea) {
                            return linea !== text;
                        });
                        break;
                    case "ID_CON":
                        aIdEBELN = aIdEBELN.filter(function (linea) {
                            return linea !== text;
                        });
                        break;
                    case "IdUSER":
                        aIdUSER = aIdUSER.filter(function (linea) {
                            return linea !== text;
                        });
                    default:
                        // Code to execute if no cases match
                        break;
                }

            }
            if (oEvent.getParameter("addedTokens")[0]) {
                var textAdded = oEvent.getParameter("addedTokens")[0].getKey();
                switch (shortId) {
                    case "IdEBELN":
                        aIdEBELN.push(textAdded);
                        break;
                    case "IdPSPNR":
                        aIdPSPNR.push(textAdded);
                        break;
                    case "ID_CON":
                        aIdEBELN.push(textAdded);
                        break;
                    case "IdUSER":
                        aIdUSER.push(textAdded);
                    default:
                        // Code to execute if no cases match
                        break;
                }

            }

        },

        onClearQuery: function () {
            this.byId("multiInEmail").removeAllTokens();
            this.byId("multiInAppId").removeAllTokens();
            this._query();
        },

        validateRol: function (aJsonRol) {
            aJsonRol.forEach((oItem) => {
                if (oItem.CREATE === "X") {
                    //this.getView().byId("idBtnCreate").setVisible(true);
                }

            });
        },
        /// Set Cloumns
        onOpenColumnSettings: function () {
            this.byId("columnSettingsDialog").open();
        },
        onCloseColumnSettings: function () {
            this.byId("columnSettingsDialog").close();
        },
        onToggleColumnVisibility: function (oEvent) {
            let sColumn = oEvent.getSource().getTitle();
            let oModel = this.getView().getModel("settingsModel");
            let bCurrentValue = oModel.getProperty("/" + sColumn);
            oModel.setProperty("/" + sColumn, !bCurrentValue);
        },
        ///

        //################### -------------------------------- Begin Variant
        _onVariantLoad: function () {
            var oFilterBar = this.getView().byId("filterbar");
            var oSmartVariant = this.getView().byId("svm");
            var oVariantData = oSmartVariant.getVariantContent();
            var sNewVariantId = oSmartVariant.getCurrentVariantId();
            if (sNewVariantId === "") {
                sNewVariantId = "PROG_ALMACEN_VARIANT";
            } else { sNewVariantId = "PROG_ALMACEN_VARIANT_" + sNewVariantId; }

            var sSavedVariant = localStorage.getItem(sNewVariantId);
            if (sSavedVariant) {
                var oVariantData = JSON.parse(sSavedVariant);
                this.getView().byId("IdEBELN").setTokens(oVariantData.filterData.IdEBELN.map(value => new sap.m.Token({ key: value.key, text: value.text })));
                this.getView().byId("IdPSPNR").setTokens(oVariantData.filterData.IdPSPNR.map(value => new sap.m.Token({ key: value.key, text: value.text })));
                this.getView().byId("ID_CON").setTokens(oVariantData.filterData.IdBANFN.map(value => new sap.m.Token({ key: value.key, text: value.text })));
                this.getView().byId("IdUSER").setTokens(oVariantData.filterData.IdUSER.map(value => new sap.m.Token({ key: value.key, text: value.text })));
                this._applyTableSettings(oVariantData.tableSettings);
            }
        },

        onVariantSave: function (oEvent) {
            var oFilterBar = this.getView().byId("filterbar"); // Obtener la referencia del FilterBar
            var oSmartVariant = this.getView().byId("svm");
            var oVariantData = oSmartVariant.getVariantContent();
            var sVariantId = oSmartVariant.getCurrentVariantId();
            if (sVariantId === "") {
                sVariantId = "VARIANT_1";
            }
            var oFilterData = {
                variantId: sVariantId,
                IdEBELN: this.getView().byId("IdEBELN").getTokens().map(token => ({
                    key: token.getKey(),
                    text: token.getText()
                })),
                IdPSPNR: this.getView().byId("IdPSPNR").getTokens().map(token => ({
                    key: token.getKey(),
                    text: token.getText()
                })),
                ID_CON: this.getView().byId("ID_CON").getTokens().map(token => ({
                    key: token.getKey(),
                    text: token.getText()
                })),
                IdUSER: this.getView().byId("IdUSER").getTokens().map(token => ({
                    key: token.getKey(),
                    text: token.getText()
                }))
            };
            var oTableSettings = this._getTableSettings();
            var oVariantData = {
                filterData: oFilterData,
                tableSettings: oTableSettings
            };
            this.currentVariantJson = JSON.stringify(oVariantData);
            localStorage.setItem("PROG_ALMACEN_VARIANT_" + sVariantId, this.currentVariantJson);
            this.executeAfterDelay();
            //MessageToast.show("Page Variant Saved!");
        },
        _onVariantChange: function (oEvent) {
            var oSmartVariant = this.getView().byId("svm");
            this.onResetParameters();
            var sNewVariantId = oSmartVariant.getCurrentVariantId();
            var sSavedVariant = localStorage.getItem("PROG_ALMACEN_VARIANT_" + sNewVariantId);
            if (sSavedVariant) {
                var oVariantData = JSON.parse(sSavedVariant);
                this.getView().byId("IdEBELN").setTokens(oVariantData.filterData.IdLIFNR.map(value => new sap.m.Token({ key: value.key, text: value.text })));
                this.getView().byId("IdPSPNR").setTokens(oVariantData.filterData.IdPSPNR.map(value => new sap.m.Token({ key: value.key, text: value.text })));
                this.getView().byId("ID_CON").setTokens(oVariantData.filterData.IdEBELN.map(value => new sap.m.Token({ key: value.key, text: value.text })));
                this.getView().byId("IdUSER").setTokens(oVariantData.filterData.IdUSER.map(value => new sap.m.Token({ key: value.key, text: value.text })));
                this._applyTableSettings(oVariantData.tableSettings);
                //MessageToast.show("Page Variant Loaded!");
            }
        },
        executeAfterDelay: function () {
            var delayTime = 1500;
            var that = this;
            setTimeout(function () {
                var oSmartVariant = that.getView().byId("svm");
                if (oSmartVariant) {
                    if (that.currentVariantJson !== "") {
                        var sVariantId = oSmartVariant.getCurrentVariantId();
                        localStorage.setItem("PROG_ALMACEN_VARIANT_" + sVariantId, that.currentVariantJson);
                    }
                }
            }, delayTime);
            // Verificar si el control SmartVariantManagement está listo

        },
        _getTableSettings: function () {
            var oTable = this.getView().byId("progrAlmacenTable");
            return {
                visibleColumns: oTable.getColumns().length // Example: Capture visible columns
            };
        },

        // Apply Table Settings
        _applyTableSettings: function (oSettings) {
            var oTable = this.getView().byId("progrAlmacenTable");
            console.log("Applying Table Settings:", oSettings);
        },
        //##########End Variant
        //##########
        // Initial Navigations ######################### Create, Copy & Read ----- #########################
        // 
        navigateToCreate: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            BusyIndicator.show(0);
            oRouter.navTo("ObjectPage", {
                mode: "a",
                objectId: "New"
            });
        },
        navigateToCreateandCopy: function () {
            const oTable = this.byId("progrAlmacenTable"); // Obtiene la tabla
            const aSelectedIndices = oTable.getSelectedItems(); // Obtiene las filas seleccionadas
            const i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            let msgElemt = i18.getText("valCopy");
            let msgMoreElm = i18.getText("valMele");
            if (aSelectedIndices.length === 0) {
                MessageToast.show(msgElemt);
                return;
            }

            if (aSelectedIndices.length > 1) {
                MessageToast.show(msgMoreElm);
                return;
            }

            // Si hay exactamente un elemento seleccionado, toma el primero
            const oSelectedContext = aSelectedIndices[0].getBindingContext("serviceModel");
            const oSelectedData = oSelectedContext.getObject();
            var sIdEBELN = oSelectedData.EBELN; // Ajusta la propiedad según tu modelo

            // Navigate to the ObjectPage
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            BusyIndicator.show(0);
            oRouter.navTo("ObjectPage", {
                mode: "c",
                objectId: sIdEBELN
            });
        },

        getDetailReadSpecificPos: function (oEvent) {
            var sIdEBELN = oEvent.getSource().getBindingContext("serviceModel").getProperty("EBELN");

            // Navigate to the ObjectPage
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            BusyIndicator.show(0);
            oRouter.navTo("ObjectPage", {
                mode: "r",
                objectId: sIdEBELN
            });

        },
        //
        // End Navigations ######################### Create, Copy & Read ----- #########################
        //////////////////////////////////////////////////
        /////////////////////////////////////////////////

        // Función auxiliar para limpiar sesiones del usuario
        _cleanupUserSessions: function () {
            // Ejecutar la limpieza de sesiones de manera asíncrona sin bloquear onInit
            Services.DeleteUserSessions().then(deleteResult => {
                if (deleteResult && deleteResult !== "Error") {
                    console.log("✅ Sesiones del usuario limpiadas exitosamente");
                } else {
                    console.warn("⚠️ Advertencia al limpiar sesiones del usuario:", deleteResult);
                }
            }).catch(e => {
                console.error("❌ Error limpiando sesiones del usuario:", e);
            });
        },

        _onMainMatched: function (oEvent) {
            this._cleanupUserSessions();
        }


    });
});
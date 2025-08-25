sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/m/Token",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/base/i18n/Localization",
    "com/xcaret/recepcionarticulosoff/utils/Services",
    "com/xcaret/recepcionarticulosoff/utils/Json",
    "com/xcaret/recepcionarticulosoff/utils/Users"
], (Controller, JSONModel, MessageToast, Fragment, Token, MessageBox, BusyIndicator, Localization, Services, Json, Users) => {
    "use strict";
    let inputsFields = [];
    let currentDate = new Date();
    let oIdMaterial, bURL, vGlobalWears = "";
    var oUrlMaterials, oUrlSuppliers, oUrlProjects, oUrlRequerimientos, oUrlRequerimient, oUrlMoneda, oURLApp, oURLRol;
    var oVarBrand = "1"; var oVarRequerimiento = "2"; var oVarProject = "3"; var oVarSupplier = "4"; var oVarMaterials = "5"; var oVarMoneda = "6"; var oVarApps = "7"; var oVarRol = "8";
    var oContractAll = [], oContractItems = [];
    var oSuccessUrl;
    var oErrorModel;
    var smodeId, sObjectId;
    let oBuni18n;
    var oView;
    var oDial;
    //var aDelPos = [];
    var sMaxPos, sOrgMaxPos;
    const FragmentMap = [
        {
            "DialogRout": "com.xcaret.recepcionarticulosoff.fragments.AddToTable",
            "DialogID": "myDialog"
        },
        {
            "DialogRout": "com.xcaret.cotizaciones.fragments.IdSupp",
            "DialogID": "idSupplierDialog",
            "TableID": "quotationTableSupplier"
        },
        {
            "DialogRout": "com.xcaret.cotizaciones.fragments.IdProject",
            "DialogID": "idProjectDialog",
            "TableID": "quotationTableProject"
        },
        {
            "DialogRout": "com.xcaret.cotizaciones.fragments.ReferenceTo",
            "DialogID": "idReferenceTo",
            "TableID": "idReferenceToTableRequeriment"
        }
    ];
    let sUserName = "UsuarioDesconocido", sFName, sLName, sEmail;
    let sProcess = "RECEPCION", sSubProcess = "ART-ALM", sAppID = "012", sApprID = "SIGN1";
    let sValidateOnBack = false;
    let oItemsArray = [], oItemsTemp = [], oItemReq = [], oSearchQuotationPos, oActualQuotationPos, oFlagPos, iIndex, aJsonCreate;

    let oJsonCreate = [{
        "EBELN": "",
        "ID_PEP": "",
        "PSPNR": "",
        "STATUS": null,
        "ERNAM": "",
        "Items": []
    }];

    let sTotalHeader = 0.00, sStatusHeaderQuoatation; var sCurrentLanguage;
    let idProgAlmacen, oHeader, oSsubtitle, oEditstatus;
    let aUpdateRequerments = []; let formattedValue, sCargo, sTcambio;
    let aIdLIFNR = [], aIdPSPNR = [], aIdCONTRA = [], aIdEBELN = [], aCotiza = [];
    let host = "https://experiencias-xcaret-parques-s-a-p-i-de-c-v--xc-btpdev-15aca4ac6.cfapps.us10-001.hana.ondemand.com";

    return Controller.extend("com.xcaret.recepcionarticulosoff.controller.ObjectPage", {
        // Constantes para gestión de sesiones
        SESSION_UPDATE_INTERVAL: 60000, // 60 segundos

        onInit: async function () {
            // Variable para el intervalo de renovación de sesión
            this._sessionInterval = null;
            oBuni18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            sCurrentLanguage = oBuni18n.getText("idioma");
            var oGlobalModel = new JSONModel({
                enabled: false,
                lifnr_des: "",
                lifnr: "",
                titleProj: "",
                xdifica: false,
                EBELN: "",
                STATUS_TEXT: "",
                STATUS_ICON: "",
                STATUS_STATE: "Success",
                enabled_d: false,
                // Nuevo código sesiones
                messageStripText: ""
            });
            this.getView().setModel(oGlobalModel, "globalModel");


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

            let oModel = new sap.ui.model.json.JSONModel();
            this.getView().setModel(oModel, "serviceModel");

            this.getCurrentUserName();
            //this.onPutUserInformation();

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("ObjectPage").attachPatternMatched(this._onObjectMatched, this);

            this.multiQuery();


            //this.onGetProcessInformation();
            oHeader = this.byId("idObjectPageHeader");


            var oGlobalModel2 = new JSONModel({
                enableds: false
            });
            this.getView().setModel(oGlobalModel2, "globalModelNoEditables"); //fields to process no editable

            // Set the serviceModel as the detailModel in the view
            const oLocalData = this.getOwnerComponent().getModel("serviceModel");
            this.getView().setModel(oLocalData, "detailModel");

            // Offline
            this._fragments = {};
            for (const frag of FragmentMap) {
                try {
                    this._fragments[frag.DialogID] = await Fragment.load({
                        id: this.createId(frag.DialogID),
                        name: frag.DialogRout,
                        controller: this
                    });
                    this.getView().addDependent(this._fragments[frag.DialogID]);
                } catch (e) {
                    // Si falla la carga, puedes mostrar un mensaje de error o simplemente continuar
                    console.warn(`No se pudo cargar el fragmento ${frag.DialogID}:`, e);
                }
            }
        },
        onAfterRendering: function () {
            let sNameComplete = sFName + " " + sLName;
            var sVn = this.getView().byId("titleName");
            sVn.setText(sNameComplete);
        },

        // Offline
        _onObjectMatched: async function (oEvent) {
            this.bSignAuth = false; //sign
            aUpdateRequerments = [];
            sTotalHeader = 0.00;
            this._scrollToHeader();

            var oTable = this.getView().byId("ItemsTable");
            oTable.removeSelections(true);

            sObjectId = oEvent.getParameter("arguments").objectId;
            smodeId = oEvent.getParameter("arguments").mode;

            var oMultiInputProy = this.getView().byId("IdPSPNR");
            oMultiInputProy.removeAllTokens();
            sValidateOnBack = false;

            // --- MODO OFFLINE ---
            if (!window.navigator.onLine) {
                sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], async function (indexedDBService) {
                    let detail = await indexedDBService.getById("ScheduleLineDetail", sObjectId);
                    console.log(detail);

                    if (detail) {
                        // Enriquecimiento y actualización del modelo principal
                        if (detail.items && !detail.Items) {
                            detail.Items = this.enrichScheduleLineItems(detail.items);
                        } else if (detail.Items) {
                            detail.Items = this.enrichScheduleLineItems(detail.Items);
                        }
                        this.getView().getModel("serviceModel").setProperty("/ScheduleLine", detail);
                        this.onAddTotal(detail.Items || []);
                        this.getView().getModel("serviceModel").refresh(true);

                        // Actualiza cabecera (globalModel)
                        var oGlobalModel = this.getView().getModel("globalModel");
                        oGlobalModel.setProperty("/EBELN", detail.EBELN || "");
                        oGlobalModel.setProperty("/lifnr", detail.LIFNR || "");
                        oGlobalModel.setProperty("/lifnr_des", detail.SUP_NAME || "");
                        oGlobalModel.setProperty("/titleProj", detail.PROJ_NAME || "");
                        var stat = detail.GENERAL_STATUS || detail.STATUS || 1;
                        var oStatusObj = this._getStatusObj(parseInt(stat));
                        oGlobalModel.setProperty("/STATUS_TEXT", oStatusObj.STATUS_TEXT);
                        oGlobalModel.setProperty("/STATUS_ICON", oStatusObj.STATUS_ICON);
                        oGlobalModel.setProperty("/STATUS_STATE", oStatusObj.STATUS_STATE);
                        oGlobalModel.refresh();

                        // MultiInput Proyecto
                        var oMultiInputProy = this.getView().byId("IdPSPNR");
                        oMultiInputProy.removeAllTokens();
                        if (detail.ID_PEP && detail.PROJ_NAME) {
                            oMultiInputProy.addToken(new Token({
                                key: detail.ID_PEP,
                                text: detail.PROJ_NAME
                            }));
                        }

                        // MultiInput Contrato
                        var oMultiInputContrato = this.getView().byId("ID_CON");
                        oMultiInputContrato.removeAllTokens();
                        if (detail.items && detail.items.length > 0) {
                            var contractItem = detail.items.find(item => item.ID_CON && item.CON_NAME);
                            if (contractItem) {
                                oMultiInputContrato.addToken(new Token({
                                    key: contractItem.ID_CON,
                                    text: contractItem.CON_NAME
                                }));
                            }
                        }

                        // MultiInput Responsable
                        var oMultiInputResp = this.getView().byId("IdRESP");
                        oMultiInputResp.removeAllTokens();
                        if (detail.ERNAM && detail.RESP_NAME && detail.RESP_LNAME) {
                            let completeName = detail.RESP_NAME + " " + detail.RESP_LNAME
                            oMultiInputResp.addToken(new Token({
                                key: detail.ERNAM,
                                text: completeName
                            }));
                        }

                        // DatePicker Programación (fecha de recepción)
                        var oDatePicker = this.byId("IdEINDTDatePicker");
                        if (oDatePicker) {
                            var dateValue = detail.CREATED_AT || "";
                            // Extrae solo la fecha (primeros 10 caracteres)
                            var formattedDate = dateValue ? dateValue.substring(0, 10) : "";
                            oDatePicker.setValue(formattedDate);
                        }

                        // DatePicker Contabilización
                        var oDatePicker2 = this.byId("IdEINDTDatePicker2");
                        if (oDatePicker2) {
                            oDatePicker2.setValue(detail.BUDAT || "");
                        }
                    } else {
                        sap.m.MessageToast.show("No hay datos offline para este documento.");
                        this.getView().getModel("serviceModel").setProperty("/ScheduleLine", {});
                        this.onAddTotal([]);
                        this.getView().getModel("serviceModel").refresh(true);
                    }
                    BusyIndicator.hide();
                }.bind(this));
                return;
            }

            // --- MODO ONLINE ---
            this.sModeUpdate = this.getModeUpdate(sObjectId);
            this.checkSignConfiguration(); //26.06.2025
            
            // --------- GESTIÓN DE SESIÓN: BLOQUEO (SOLO MODO ONLINE) ---------
            if (smodeId === "r" && sObjectId !== "New") {
                // Solo verificar sesiones si está online
                if (window.navigator.onLine) {
                    try {
                        // 1. Consultar si el documento está bloqueado por otro usuario
                        const sessionBlocked = await Services.GetSession(this, sObjectId);
                        const oGlobalModel = this.getView().getModel("globalModel");

                        if (sessionBlocked) {
                            // 2. Si está bloqueado, verificar si es por el usuario actual
                            const oSession = this.getView().getModel("serviceModel").getProperty("/Session") || {};
                            const currentUser = Users.getUserInfo();
                            const sessionUser = oSession.ERNAM;

                            console.log("🔍 Verificación inicial de bloqueo:");
                            console.log("🔍 Usuario actual:", currentUser.sUserId);
                            console.log("🔍 Usuario de sesión:", sessionUser);
                            console.log("🔍 ¿Es el mismo usuario?", currentUser.sUserId === sessionUser);

                                                            // Solo bloquear si es un usuario diferente
                                if (currentUser.sUserId !== sessionUser) {
                                    // Documento bloqueado por otro usuario
                                    console.log("🔒 Documento bloqueado por otro usuario:", sObjectId);
                                    oGlobalModel.setProperty("/enabled", false);
                                    oGlobalModel.setProperty("/messageStripText", ""); // Limpiar mensaje anterior
                                    
                                    // Extraer nombre del ERNAM híbrido para el modelo global
                                    this._showBlockedMessageFromHybridERNAMGlobal(oSession.ERNAM);
                                    
                                    // Bloquear botones de edición (solo inhabilitar, no cambiar visibilidad)
                                    this._setEditButtonState(false, "Documento bloqueado por otro usuario");
                                    this.byId("idBtnSave").setEnabled(false);

                                } else {
                                    // Es el mismo usuario, permitir edición
                                    console.log("✅ Documento bloqueado por usuario actual, permitiendo edición:", sObjectId);
                                    oGlobalModel.setProperty("/enabled", false); // solo lectura
                                    oGlobalModel.setProperty("/messageStripText", "");
                                    this._setEditButtonState(true, "Usuario actual tiene bloqueo activo");
                                    this.byId("idBtnSave").setEnabled(true);
                                }
                        } else {
                            // Si NO está bloqueado, oculta mensaje y sigue flujo normal
                            console.log("✅ Documento disponible para edición:", sObjectId);
                            oGlobalModel.setProperty("/enabled", false); // solo lectura
                            oGlobalModel.setProperty("/messageStripText", "");
                            this._setEditButtonState(true, "Documento disponible para edición");
                            this.byId("idBtnSave").setEnabled(true);
                        }
                    } catch (e) {
                        console.error("❌ Error verificando sesión del documento:", e);
                        // En caso de error, permitir edición pero mostrar advertencia
                        oGlobalModel.setProperty("/messageStripText", oBuni18n.getText("SESSION_BLOCKED_MESSAGE"));
                        // Solo habilitar/inhabilitar botones, no cambiar visibilidad
                        this._setEditButtonState(true, "Error en verificación de sesión - permitiendo edición");
                        this.byId("idBtnSave").setEnabled(true);
                    }
                } else {
                    // Modo offline: no verificar sesiones
                    console.log("📱 Modo offline: No se verifica gestión de sesiones");
                    const oGlobalModel = this.getView().getModel("globalModel");
                    oGlobalModel.setProperty("/messageStripText", "");
                    // Solo habilitar/inhabilitar botones, no cambiar visibilidad
                    this._setEditButtonState(true, "Modo offline - permitiendo edición");
                    this.byId("idBtnSave").setEnabled(true);
                }
            } else {
                // Si es modo creación/copia, flujo normal y oculta mensaje
                const oGlobalModel = this.getView().getModel("globalModel");
                oGlobalModel.setProperty("/messageStripText", "");
                // En modo creación/copia, los botones se manejan por roles
            }
            
            console.log(smodeId)
            switch (smodeId) {
                case "r"://Read
                    this._clearMultiInputs();
                    this._cleanViewFields();
                    this.getView().byId("idBtnEdit").setVisible(true);
                    this.byId("IdEINDTDatePicker2").setValue(currentDate.toISOString().split("T")[0]);
                    this.byId("idBttonReference").setEnabled(false);
                    this.onEditFields(false, smodeId);
                    oMultiInputProy.setEnabled(false);
                    aIdEBELN = [];
                    aIdEBELN.push(sObjectId);
                    this.multiQuery();
                    this._onQuery("ProgAlmacen");
                    this._setEnabledEditPos(false);
                    this.enableFieldsBySign(); //sign
                    BusyIndicator.hide();
                    break;
                case "c"://Copy
                    this.onGetDetailData(sObjectId);
                    this.onEditFields(true, smodeId);
                    this.byId("IdERNAMInput").setValue(sUserName);
                    this.onAddTotal([]);
                    BusyIndicator.hide();
                    break;
                case "a"://Add
                    this._clearMultiInputs();
                    this._cleanViewFields();
                    this.getView().byId("idBtnEdit").setVisible(false);
                    this.byId("switchXdifica").setEnabled(false);
                    this.byId("switchXdifica").setState(false);
                    this.byId("idBttonReference").setEnabled(false);
                    oMultiInputProy.setEnabled(true);
                    let oModelZ = new sap.ui.model.json.JSONModel();
                    this.getView().setModel(oModelZ, "serviceModel");
                    this.multiQuery();
                    this.onEditFields(true, smodeId);
                    this.byId("IdEINDTDatePicker").setValue(currentDate.toISOString().split("T")[0]);
                    this.onAddTotal([]);
                    var oModelRol = this.getView().getModel("serviceModel");
                    const aCurrentRole = oModelRol.getProperty("/generalRol")
                    if (aCurrentRole) {
                        this.validateRol(aCurrentRole);
                    }
                    this._setViewProperties();
                    BusyIndicator.hide();
                    break;
                default:
                    break;
            }
            console.log(this.getView().getModel("serviceModel"))
        },
        // Offline
        /**
        * Enriquecer los items del detalle recuperado de IndexDB con los campos esperados por la vista
        * @param {Array} itemsOriginal - arreglo de posiciones crudas de IndexedDB
        * @returns {Array} - arreglo enriquecido
        */
        enrichScheduleLineItems: function (itemsOriginal) {
            return itemsOriginal.map(item => {
                return {
                    EBELP: item.EBELP || "",
                    ID_CON: item.ID_CON || "",
                    CONPO: item.CONPO || "",
                    IMAG: item.IMAGE || "N/A",
                    IMAG_ENAB: item.IMAGE ? true : false,
                    IMAGE_SRC: item.MATNR ? (host + "/ImageMaterial/" + item.MATNR) : "",
                    MAT_MATNR: item.MATNR || "",
                    MAT_NAME: item.MAT_NAME || item.MAKTX1 || item.MAT_NAME || "",
                    LINENAME: item.MATNR && item.MAT_NAME ? item.MAT_NAME : (item.MAT_NAME || item.MATNR || ""),
                    MENGE: item.MENGE || "",
                    QTY_AVA: item.CONTR_AVAIL || item.EBAN_AVAIL || "",
                    QTY_DELIV: item.WEMNG || "",
                    QTY_DELIV_COPY: item.WEMNG || "",
                    COMMENT: "",
                    MENGE_C: item.MENGE_C || "",
                    MEINS: item.MEINS || item.MAT_MEINS || "",
                    RECEP_XDIFICA: (item.EMXDI === "X") ? true : false,
                    EINDT: item.EINDT || "",
                    CAT_ID: item.CAT_ID || "",
                    CAT_DESC: item.CAT_DESC || "",
                    CATEGORY: item.CAT_DESC || "",
                    FAM_ID: item.FAM_ID || "",
                    FAM_DESC: item.FAM_DESC || "",
                    FAMILY: item.FAM_DESC || "",
                    BRA_ID: item.BRA_ID || "",
                    BRA_DESC: item.BRA_DESC || "",
                    BRAND: item.BRA_DESC || "",
                    MOD_ID: item.MOD_ID || "",
                    MOD_DESC: item.MOD_DESC || "",
                    MODEL: item.MOD_DESC || "",
                    DIMENSIONS: item.MAT_DIMENS || "",
                    STANDARD_IND: (item.MAT_IND_STAN === "X") ? true : false,
                    IND_ACT_FIJO: (item.MAT_IND_ASSET === "X") ? true : false,
                    HERITAGE: (item.MAT_PATR === "X") ? true : false,
                    SPECIALS: false,
                    FFE: (item.MAT_FFE === "X") ? true : false,
                    DIV_ID: item.DIV_ID || "",
                    DIV_DESC: item.DIV_DESC || "",
                    DIVISION: item.DIV_DESC || "",
                    AREA_ID: item.AREA_ID || "",
                    AREA_DESC: item.AREA_DESC || "",
                    AREA: item.AREA_DESC || "",
                    LOCATION: item.EBAN_UBICA || "",
                    SUBLOCATION: item.REQ_SUBIC || "",
                    REQ_SUMIN: item.EBAN_SUMIN || "",
                    REQ_SUMIN_DESC: item.REQ_SUMIN_DESC || "",
                    SUPPLIED: item.REQ_SUMIN_DESC || "",
                    REQ_VISTA: item.EBAN_VISTA || "",
                    REQ_VISTA_DESC: item.REQ_VISTA_DESC || "",
                    VIEW: item.REQ_VISTA_DESC || "",
                    BANFN: item.BANFN || "",
                    BNFPO: item.BNFPO || "",
                    ERNAM: item.ERNAM || "",
                    CREATION_NAME: item.CREATION_NAME || "",
                    CREATION_LNAME: item.CREATION_LNAME || "",
                    CREATION_EMAIL: item.CREATION_EMAIL || "",
                    STATU: item.STATU || "1",
                    STATUS: item.STATU || "1",
                    STATUS_TEXT: this._getStatusObj(parseInt(item.STATU || "1")).STATUS_TEXT,
                    STATUS_ICON: this._getStatusObj(parseInt(item.STATU || "1")).STATUS_ICON,
                    STATUS_STATE: this._getStatusObj(parseInt(item.STATU || "1")).STATUS_STATE,
                    LINE_STATUS: "E"
                }
            });
        },
        /*
        getModeUpdate: function (sDocument) {
            this._aImageSource = [];
            this._aDeleteImageSource = [];
            this.sObjMBLRN = "";
            this.aReceptMaterials = [];
            let url = `${host}/MaterialDocument?$filter=XBLNR EQ '${sDocument}'`;
            var aResponse = this.getDataRangesSynchronously(url);
            var oLabRecept = this.byId("labRecept");
            var oObjRecept = this.byId("objIdenRecept");
            oLabRecept.setVisible(false);
            oObjRecept.setVisible(false);
            oObjRecept.setTitle("");
            if (aResponse.error) {
                return "c"; //create: no existe el documento
            } else {
                if (aResponse.result) {
                    if (aResponse.result.length > 0) {
                        this.sObjMBLRN = aResponse.result[0].MBLRN;
                        this.aReceptMaterials = this._getReceptMaterials(this.sObjMBLRN);
                        this._loadRecepImages(this.sObjMBLRN);
                        oLabRecept.setVisible(true);
                        oObjRecept.setVisible(true);
                        oObjRecept.setTitle(this.sObjMBLRN);
                    }
                }
                return "u"; //update
            }
        },
        */
        // Offline
        getModeUpdate: async function (sDocument) {
            this._aImageSource = [];
            this._aDeleteImageSource = [];
            this.sObjMBLRN = "";
            this.aReceptMaterials = [];

            // --- MODO OFFLINE ---
            if (!window.navigator.onLine) {
                const indexedDBService = sap.ui.require("com/xcaret/recepcionarticulosoff/model/indexedDBService");
                // Busca el detalle guardado en la store ScheduleLineDetail por EBELN
                let detail = await indexedDBService.getById("ScheduleLineDetail", sDocument);
                if (detail && detail.MBLRN) {
                    this.sObjMBLRN = detail.MBLRN;
                    // Guarda materiales del detalle si existen
                    if (detail.items) {
                        this.aReceptMaterials = detail.items;
                    }
                    // Carga imágenes offline
                    await this._loadRecepImagesOffline(this.sObjMBLRN);
                }
                return "u"; //update
            }

            // --- MODO ONLINE (original) ---
            let url = `${host}/MaterialDocument?$filter=XBLNR EQ '${sDocument}'`;
            var aResponse = this.getDataRangesSynchronously(url);
            var oLabRecept = this.byId("labRecept");
            var oObjRecept = this.byId("objIdenRecept");
            oLabRecept.setVisible(false);
            oObjRecept.setVisible(false);
            oObjRecept.setTitle("");
            if (aResponse.error) {
                return "c"; //create: no existe el documento
            } else {
                if (aResponse.result) {
                    if (aResponse.result.length > 0) {
                        this.sObjMBLRN = aResponse.result[0].MBLRN;
                        this.aReceptMaterials = await this._getReceptMaterials(this.sObjMBLRN);
                        await this._loadRecepImages(this.sObjMBLRN);
                        oLabRecept.setVisible(true);
                        oObjRecept.setVisible(true);
                        oObjRecept.setTitle(this.sObjMBLRN);
                    }
                }
                return "u"; //update
            }
        },

        // Offline
        _loadRecepImagesOffline: async function (sObjMBLRN) {
            var aReturn = [];
            const indexedDBService = sap.ui.require("com/xcaret/recepcionarticulosoff/model/indexedDBService");
            // Todas las imágenes precargadas para este MBLRN
            let allImages = await indexedDBService.getAll("Images");
            let filteredImages = allImages.filter(img => img.MBLRN === sObjMBLRN);

            filteredImages.forEach(img => {
                aReturn.push({
                    LINE_ID: img.LINE_ID,
                    src: `data:${img.mimeType};base64,${img.data}`,
                    fileEntry: null,
                    filename: img.IMAGE_NAME,
                    index: img.INDEX,
                    ind: "e" // imagen ya existe
                });
            });

            this._aImageSource = aReturn;
            return;
        },

        /*
        _loadRecepImages: function (sObjMBLRN) {
            var aReturn = [];
            let url = `${host}/ImageMaterialReceptionItem/${sObjMBLRN}`;
            var aResponse = this.getDataRangesSynchronously(url);
            if (aResponse) {
                if (aResponse.images) {
                    if (aResponse.images.length > 0) {
                        aReturn = aResponse.images;
                    }
                }
            }

            for (var i = 0; i < aReturn.length; i++) {
                this._aImageSource.push({
                    pos: aReturn[i].LINE_ID,
                    src: `data:${aReturn[i].mimeType};base64,${aReturn[i].data}`, // prefijo incluido
                    fileEntry: null,  // no tienes archivo local aquí
                    filename: aReturn[i].IMAGE_NAME,
                    index: aReturn[i].INDEX,
                    ind: "e" // imagen ya existe
                });
            }
        },
        */
        // Offline
        _loadRecepImages: async function (sObjMBLRN) {
            if (!window.navigator.onLine) {
                return await this._loadRecepImagesOffline(sObjMBLRN);
            }
            var aReturn = [];
            let url = `${host}/ImageMaterialReceptionItem/${sObjMBLRN}`;
            var aResponse = this.getDataRangesSynchronously(url);
            if (aResponse && aResponse.images && aResponse.images.length > 0) {
                for (var i = 0; i < aResponse.images.length; i++) {
                    this._aImageSource.push({
                        pos: aResponse.images[i].LINE_ID,
                        src: `data:${aResponse.images[i].mimeType};base64,${aResponse.images[i].data}`,
                        fileEntry: null,
                        filename: aResponse.images[i].IMAGE_NAME,
                        index: aResponse.images[i].INDEX,
                        ind: "e" // imagen ya existe
                    });
                }
            }
        },

        /*
        _getReceptMaterials: function (sObjMBLRN) {
            var aReturn = [];
            let url = `${host}/MaterialDocument/${sObjMBLRN}`;
            var aResponse = this.getDataRangesSynchronously(url);
            if (aResponse.result) {
                if (aResponse.result.length > 0) {
                    if (aResponse.result[0].items) {
                        this.oReceptMaterialsHeader = aResponse.result[0];
                        this._updateFechaConta(this.oReceptMaterialsHeader.BUDAT);
                        aReturn = aResponse.result[0].items;
                    }
                }
            }
            return aReturn;
        },
        */
        // Offline
        _getReceptMaterials: async function (sObjMBLRN) {
            var aReturn = [];
            if (!window.navigator.onLine) {
                const indexedDBService = sap.ui.require("com/xcaret/recepcionarticulosoff/model/indexedDBService");
                // Busca por EBELN en ScheduleLineDetail
                let detail = await indexedDBService.getById("ScheduleLineDetail", sObjMBLRN);
                if (detail && detail.items) {
                    this.oReceptMaterialsHeader = detail;
                    this._updateFechaConta(detail.BUDAT);
                    aReturn = detail.items;
                }
                return aReturn;
            }

            // --- MODO ONLINE ---
            let url = `${host}/MaterialDocument/${sObjMBLRN}`;
            var aResponse = this.getDataRangesSynchronously(url);
            if (aResponse.result) {
                if (aResponse.result.length > 0) {
                    if (aResponse.result[0].items) {
                        this.oReceptMaterialsHeader = aResponse.result[0];
                        this._updateFechaConta(this.oReceptMaterialsHeader.BUDAT);
                        aReturn = aResponse.result[0].items;
                    }
                }
            }
            return aReturn;
        },

        _updateFechaConta: function (sValue) {
            var oDatePicker = this.byId("IdEINDTDatePicker2");
            oDatePicker.setValue(sValue);
        },

        _setViewProperties: function (oHeaderObj) {
            if (smodeId === "a") {
                var oObj = this._getStatusObj(1);
                var oGlobalModel = this.getView().getModel("globalModel");
                var i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                oGlobalModel.setProperty("/EBELN", i18.getText("TITLE_NEW"));
                oGlobalModel.setProperty("/STATUS_TEXT", oObj.STATUS_TEXT);
                oGlobalModel.setProperty("/STATUS_ICON", oObj.STATUS_ICON);
                oGlobalModel.setProperty("/STATUS_STATE", oObj.STATUS_STATE);
                oGlobalModel.refresh();
            }

            if (smodeId === "r") {
                var iStat = parseInt(oHeaderObj.GENERAL_STATUS);
                var oObj = this._getStatusObj(iStat);
                var oGlobalModel = this.getView().getModel("globalModel");
                oGlobalModel.setProperty("/EBELN", oHeaderObj.EBELN);
                oGlobalModel.setProperty("/STATUS_TEXT", oObj.STATUS_TEXT);
                oGlobalModel.setProperty("/STATUS_ICON", oObj.STATUS_ICON);
                oGlobalModel.setProperty("/STATUS_STATE", oObj.STATUS_STATE);
                oGlobalModel.refresh();

                //Si el encabezado se encuentra con estatus de borrados, se oculta boton de editar
                if (iStat === 3) {
                    this.getView().byId("idBtnEdit").setVisible(false);
                }
            }
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
                    `${host}/Contract`,
                    `${host}/Rol?$filter=ID EQ 008 AND EMAIL EQ '${sEmail}'`
                    //`${host}/queryMaterials?&FFE=X`
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
                    //material: responses[5].data
                };

                let oModel = this.getView().getModel("serviceModel");
                oModel.setProperty("/generalProvider", responses[0].data);
                oModel.setProperty("/generalUser", this._getUserCollection(responses[1].result));
                oModel.setProperty("/generalRol", responses[2].result);
                if ([responses[2].result].every(val => val?.length !== 0)) { this.validateRol(responses[2].result); }
                oModel.setProperty("/generalProjects", responses[3].data);
                oModel.setProperty("/generalContract", responses[4].result);
                oModel.setProperty("/generalRolXdifica", responses[5].result);
                //oModel.setProperty("/generalMaterialData", responses[5].data);
                oModel.refresh();
            } catch (error) {
                console.error(error);
            }
        },
        // Query
        _onQuery: async function (sTypequery) {
            console.log(sTypequery);
            var that = this;
            try {
                let url, setModel;

                switch (sTypequery) {
                    case "RequirementProject":
                        let sProject = aIdPSPNR[0];
                        //url = `${host}/Requirement/${sProject}`;
                        url = `${host}/RequirementSpecials/${sProject}`;
                        setModel = "/RequirementProject";
                        break;
                    case "RequirementProjectEdit":
                        let sProjectEdit = aIdPSPNR[0];
                        //url = `${host}/Requirement/${sProjectEdit}`;
                        url = `${host}/RequirementSpecials/${sProjectEdit}`;
                        setModel = "/RequirementProject";
                        break;
                    case "ContratoID":
                        let sProject1 = aIdPSPNR[0];
                        url = `${host}/Contract?$filter=PSPNR EQ '${sProject1}'`;
                        setModel = "/ContratoID";
                        break;
                    case "ContratoAll":
                        let sID = aIdCONTRA[0];
                        let sIDPSPNR = aIdPSPNR[0];
                        url = `${host}/ContractItemsFromScheduleLine?$filter=EKKO.PSPNR EQ '${sIDPSPNR}' AND ID_CON EQ '${sID}'`;
                        setModel = "/ContratoAll";
                        break;
                    case "ContratoAllEdit":
                        let sIDContra = aIdCONTRA[0];
                        let sIDProy = aIdPSPNR[0];
                        url = `${host}/ContractItemsFromScheduleLine?$filter=EKKO.PSPNR EQ '${sIDProy}' AND ID_CON EQ '${sIDContra}'`;
                        setModel = "/ContratoAll";
                        break;
                    case "ProgAlmacen":
                        let sScheduleLine = aIdEBELN[0];
                        url = `${host}/ScheduleLine/${sScheduleLine}`;
                        setModel = "/ScheduleLine";
                        break;
                    case "SchedulingProyect":
                        let sSchedulingContractProyect = aIdPSPNR[0];
                        url = `${host}/ScheduleLineAll?filter=EKET.EBELP EQ '10' AND EKKO.PSPNR EQ '${sSchedulingContractProyect}'`;
                        setModel = "/ScheduleLineProyect";
                        break;
                    case "Cotizacion":
                        let oCotz = aCotiza[0];
                        url = `${host}/PurchaseOrder/'${oCotz}'`;
                        setModel = "/Cotiza";
                        break;
                    default:
                        break;
                }

                let responseData = [];
                let oModel = this.getView().getModel("serviceModel");
                let response = await fetch(url, { method: "GET" });
                if (!response.ok) throw new Error(`${response.error}`);
                responseData = await response.json();

                switch (sTypequery) {
                    case "RequirementProject":
                        //var oItemReq = responseData.data;
                        var oItemReq = responseData.result;
                        //var oSuccessMaterials = oModel.getProperty("/generalMaterialData");
                        var oSuccessMaterials = [];
                        oItemReq = that._getFilterMaterials(oItemReq, oSuccessMaterials);
                        oModel.setProperty(setModel, oItemReq);
                        break;
                    case "RequirementProjectEdit":
                        //var oItemReqEdit = responseData.data;
                        var oItemReqEdit = responseData.result;
                        //var oSuccessMaterialsEdit = oModel.getProperty("/generalMaterialData");
                        var oSuccessMaterialsEdit = []
                        oItemReqEdit = that._getFilterMaterials(oItemReqEdit, oSuccessMaterialsEdit);
                        oModel.setProperty(setModel, oItemReqEdit);
                        var aLines = oContractItems;
                        var aRefEspecialData = this._getRefEspecialData(aLines, oItemReqEdit)
                        console.log(aRefEspecialData);
                        oModel.setProperty("/RefEspecial", aRefEspecialData);
                        this._onQuery("ContratoAllEdit");
                        break;
                    case "ContratoID":
                        oModel.setProperty(setModel, responseData.result);
                        break;
                    case "ContratoAll":
                        if (responseData.result) {
                            oContractAll = responseData.result;
                            oModel.setProperty(setModel, responseData.result);
                            this.onAddContrat();
                        } else {
                            oContractAll = [];
                            oModel.setProperty(setModel, responseData.result);
                            this.onAddContrat();
                            if (responseData.error) {
                                sap.m.MessageToast.show(responseData.error);
                            }
                        }
                        break;
                    case "ContratoAllEdit":
                        if (responseData.result) {
                            oContractAll = responseData.result;
                            oModel.setProperty(setModel, responseData.result);
                            this.onAddContratEdit();
                        } else {
                            oContractAll = [];
                            oModel.setProperty(setModel, responseData.result);
                            this.onAddContratEdit();
                        }
                        break;
                    case "ProgAlmacen":
                        this.onAddTotal(responseData.response.items);
                        this._loadMultiInputsValues(responseData.response);
                        oContractItems = responseData.response;
                        this._onQuery("RequirementProjectEdit");
                        break;
                    case "SchedulingProyect":
                        oModel.setProperty(setModel, responseData.result);
                        //this.onAddTotal(responseData.result);
                        break;
                    case "Cotizacion":
                        oModel.setProperty(setModel, responseData);
                        break;
                    default:
                        break;
                }

            } catch (error) {
                console.error(error);
            }

        },

        /*
        _getFilterMaterials: function (oItemReq, oSuccessMaterials) {
            oItemReq = oItemReq
                .filter(line => {
                    let linMat = oSuccessMaterials.find(item => item.MATNR === line.MATNR);
                    if (linMat) {
                        line.MATERIALNAME = linMat.MATKT;
                        line.BRAND = linMat.BRAND;
                        line.CATEGORY = linMat.CATEGORY;
                        line.FAMILY = linMat.FAMILY;
                        line.IMAGE = linMat.IMAGE;
                        line.MODEL = linMat.MODEL;
                        line.GROES = linMat.GROES;
                        line.STAND = linMat.STAND;
                        line.ASSET = linMat.ASSET;
                        line.PATR = linMat.PATR;
                        line.FFE = linMat.FFE;
                        //line.DIVSN = linMat.DIVSN;
                        //line.AREA = linMat.AREA;
                        //line.UBICA = linMat.UBICA;
                        //line.SUBIC = linMat.SUBIC;
                        //line.SUMIN = linMat.SUMIN;
                        //line.VISTA = linMat.VISTA;
                        return true; // Keep the entry
                    }
                    return false; // Remove the entry
                });
            return oItemReq;
        },
        */

        _getFilterMaterials: function (oItemReq, oSuccessMaterials) {
            var that = this;
            var aResult = [];
            if (oItemReq !== undefined) {
                if (oItemReq.length > 0) {
                    oItemReq.forEach(function (oItem) {
                        let cloneItem = that._getCloneItem(oItem);
                        cloneItem["MATERIALNAME"] = oItem.MAT_NAME;
                        aResult.push(cloneItem);
                    });
                }
            }
            return aResult;
        },

        _getCloneItem: function (oItem) {
            return Object.assign({}, oItem);
        },

        ///////////////////////////////////////////////////////////////////////////////////////////
        ///MULTIINPUTs
        _clearMultiInputs: function () {
            var aMultiInputs = ["ID_CON", "IdLIFNR", "IdPSPNR", "IdRESP"];
            var oView = this.getView();

            aMultiInputs.forEach(function (sId) {
                var oMultiInput = oView.byId(sId);
                if (oMultiInput) {
                    oMultiInput.removeAllTokens();
                }
            });
        },
        _loadMultiInputsValues: function (LINEENTRIE) {
            var oMultiInputIdPSPNR = this.getView().byId("IdPSPNR");
            var oMultiInputIdID_CON = this.getView().byId("ID_CON");
            var oMultiInputResp = this.getView().byId("IdRESP");
            var oText = this.getView().byId("IdLIFNRInput");
            var oDatePicker = this.getView().byId("IdEINDTDatePicker");

            oMultiInputIdPSPNR.removeAllTokens();
            oMultiInputIdID_CON.removeAllTokens();
            oMultiInputResp.removeAllTokens();

            //Proyecto
            oMultiInputIdPSPNR.addToken(new Token({
                key: LINEENTRIE.ID_PEP,
                text: LINEENTRIE.PROJ_NAME
            }));

            //Responsable
            oMultiInputResp.addToken(new Token({
                key: LINEENTRIE.RESP,
                text: this._getUserDescription(LINEENTRIE.RESP)
            }));

            //var oDate = new Date(LINEENTRIE.CREATED_AT);
            //oDatePicker.setValue(oDate.getFullYear() + "-" + this._getValueDate(oDate.getMonth() + 1) + "-" + this._getValueDate(oDate.getDate()));

            var sCreatedDate = "";
            if (LINEENTRIE.CREATED_AT) {
                sCreatedDate = this.getStringDate(new Date(LINEENTRIE.CREATED_AT));
            }
            oDatePicker.setValue(sCreatedDate);

            //::PROYECTO
            aIdPSPNR[0] = LINEENTRIE.ID_PEP;

            //ERNAM
            oJsonCreate[0].ERNAM = LINEENTRIE.ERNAM;

            //LIFNR
            this._setLifnrDesc(LINEENTRIE.LIFNR, LINEENTRIE.SUP_NAME);

            if (LINEENTRIE.items) {
                LINEENTRIE.items.forEach(function (item) {

                    if (item.ID_CON) {

                        //Contrato
                        oMultiInputIdID_CON.addToken(new Token({
                            key: item.ID_CON,
                            text: item.CON_NAME
                        }))

                        //::CONTRATO
                        aIdCONTRA[0] = item.ID_CON;
                    }

                    if (item.SUP_NAME) {
                        //oText.setText(item.SUP_NAME);
                    }
                });
            }
        },

        getStringDate: function (oDate) {
            var day = String(oDate.getDate()).padStart(2, '0');
            var month = String(oDate.getMonth() + 1).padStart(2, '0'); // Los meses van de 0 a 11
            var year = oDate.getFullYear();
            return year + "-" + month + "-" + day;
        },

        _getUserDescription: function (sUserId) {
            let oModel = this.getView().getModel("serviceModel");
            let aData = oModel.getProperty("/generalUser") || [];
            var oObj = aData.filter(oItem => oItem.UserId === sUserId);
            if (oObj.length > 0) {
                return (oObj[0].UserText) ? oObj[0].UserText : "";
            } else {
                return "";
            }
        },

        _getValueDate: function (iValue) {
            if (iValue < 10) {
                return "0" + iValue;
            } else {
                return iValue;
            }
        },

        // Filters
        valueHelpFilter: function (oEvent) {
            var that = this;
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


            if (id.includes("IdLIFNR")) {
                filterId = "LIFNR";
                filterDescr = "NAME1";
                aData = oModel.getProperty("/generalProvider") || [];
                title = i18.getText("LIFNR");

            } else if (id.includes("IdPSPNR")) {
                filterId = "ID_PEP";
                filterDescr = "NAME1";
                aData = oModel.getProperty("/generalProjects") || [];
                title = i18.getText("PSPNR");

            } else if (id.includes("IdRESP")) {
                filterId = "ERNAM";
                //filterDescr = "UserText";
                filterDescr = "UserText";
                aData = oModel.getProperty("/generalUser") || [];
                title = i18.getText("RESPONSABLE");
            } else if (id.includes("ID_CON")) {
                filterId = "ID_CON";
                filterDescr = "CONAM";
                aData = oModel.getProperty("/generalContract") || [];
                title = i18.getText("ID_CON");

            }

            // Get tokens of MultiInput
            let aTokens = this._oMultiInput.getTokens().map(token => ({
                key: token.getKey(),
                text: token.getText()
            }));

            let oTemplate;
            if (id.includes("IdRESP")) {
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
                    multiSelect: false,
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

                            if (id.includes("IdRESP")) {
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

                            if (id.includes("IdLIFNR")) {
                                aIdLIFNR = [];
                                aIdLIFNR.push(textAdded);

                            } else if (id.includes("IdPSPNR")) {
                                aIdPSPNR = [];
                                aIdPSPNR.push(textAdded);
                                this._onQuery("RequirementProject");
                                this.onEnableFollow(true);

                                //clean aIdCONTRA
                                aIdCONTRA = aIdCONTRA.filter(function (linea) {
                                    return linea !== textAdded;
                                });
                                var oMultiInput = this.getView().byId("ID_CON");
                                oMultiInput.removeAllTokens();

                                //clean lifnr field
                                that._setLifnrDesc();

                            } else if (id.includes("ID_CON")) {
                                aIdCONTRA = [];
                                aIdCONTRA.push(textAdded);
                                var oObj = item.getBindingContext().getObject();
                                that._setLifnrDesc(oObj.LIFNR, oObj.NAME1);
                                this._onQuery("ContratoAll");
                            }

                        });
                        this._oSelectDialog.destroy();
                        this._oSelectDialog = null;
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

        /////////////////////////////// Begin Create dialog table Reference ///////////////////////////////////////////////
        createDialog: function () {
            var that = this;
            const i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            if (aIdPSPNR.length === 0) {
                sap.m.MessageToast.show(i18.getText("selectedRequirement"));
            } else {

                if (!this._oDialog) {
                    this._oDialog = new sap.m.Dialog({
                        id: "idReferenceTo",
                        title: this.getView().getModel("i18n").getResourceBundle().getText("searchReq"),
                        stretch: sap.ui.Device.system.phone,
                        content: [
                            new sap.m.Table({
                                id: "idReferenceToTableRequeriment",
                                width: "auto",
                                items: {
                                    path: "serviceModel>/RequirementProject",
                                    template: new sap.m.ColumnListItem({
                                        vAlign: "Middle",
                                        cells: [
                                            new sap.m.ObjectIdentifier({ title: "{serviceModel>BANFN}" }),
                                            new sap.m.ObjectIdentifier({ title: "{serviceModel>BNFPO}" }),
                                            new sap.m.ObjectIdentifier({ title: "{serviceModel>PSPNR}" }),
                                            new sap.m.ObjectIdentifier({ title: "{serviceModel>MATERIALNAME}" }),
                                            new sap.m.ObjectNumber({ number: "{serviceModel>EBAN_AVAIL}", unit: "{serviceModel>MEINS}" })
                                        ]
                                    })
                                },
                                noDataText: "{i18n>tableNoDataText}",
                                busyIndicatorDelay: "{serviceModel>/tableBusyDelay}",
                                growing: true,
                                growingScrollToLoad: true,
                                mode: sap.m.ListMode.MultiSelect,
                                selectionChange: function (oEvent) {
                                    that.onSelectionChangeReference(oEvent);
                                },
                                columns: [
                                    new sap.m.Column({ header: new sap.m.Text({ text: "{i18n>BANFN}" }) }),
                                    new sap.m.Column({ header: new sap.m.Text({ text: "{i18n>BNFPO}" }) }),
                                    new sap.m.Column({ header: new sap.m.Text({ text: "{i18n>PSPNR}" }) }),
                                    new sap.m.Column({ header: new sap.m.Text({ text: "{i18n>MATNR}" }) }),
                                    new sap.m.Column({ header: new sap.m.Text({ text: "{i18n>QTY_AVA}" }) })
                                ]
                            })
                        ],
                        buttons: [
                            new sap.m.Button({
                                id: "btnAddReference",
                                text: "{i18n>addBtn}",
                                press: this.onAddReference.bind(this),
                                type: sap.m.ButtonType.Emphasized,
                                icon: "sap-icon://add"
                            }),
                            new sap.m.Button({
                                id: "btnColseReference",
                                text: "{i18n>closeBtn}",
                                press: this.onCloseDialog.bind(this),
                                customData: [
                                    new sap.ui.core.CustomData({ key: "fragmentPath", value: "idSupplierDialog" })
                                ]
                            })
                        ]
                    });
                    this.getView().addDependent(this._oDialog);
                }
                this._oDialog.open();
            }

        },

        onCloseDialog: function (oEvent) {
            this._oDialog.close();
            this._oDialog.destroy();
            this._oDialog = null;

            const oModel = this.getView().getModel("serviceModel");
            const aGeneral = oModel.getProperty("/ScheduleLine");
            this.onAddTotal(aGeneral.Items);
        },

        showSaveDialogBeforeBack: function () {
            let that = this;

            if (!this._oDialog) {
                this._oDialog = new sap.m.Dialog({
                    title: "",
                    type: "Message",
                    content: new sap.m.Text({ text: oBuni18n.getText("msgAskSaveData") }),
                    beginButton: new sap.m.Button({
                        text: "Ok",
                        type: "Accept",
                        press: function () {
                            //that.onCreateInfo(); // Remplazar por la funcion para Update(Se necesita crear)
                            that._oDialog.close();
                            that._oDialog.destroy();
                            that._oDialog = null;
                            that._setEditEnabledLabels(true);
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "No",
                        type: "Reject",
                        press: function () {
                            that._oDialog.close();
                            that._oDialog.destroy();
                            that._oDialog = null;
                            that.onNavBack();
                        }
                    })
                });

                this.getView().addDependent(this._oDialog);
            }

            this._oDialog.open();
        },

        _setEditEnabledLabels: function (bBand) {
            //edit bBand
            var that = this;
            that.onEnableFollow(bBand);
            var oGlobalModel = that.getView().getModel("globalModel");
            oGlobalModel.setProperty("/enabled", bBand);
            var oGlobalModel2 = that.getView().getModel("globalModelNoEditables");
            oGlobalModel2.setProperty("/enabled", bBand);
            oGlobalModel2.setProperty("/enableds", bBand);
            oEditstatus = bBand;
        },

        updateTokenIdClear: function (oEvent) {
            var that = this;
            var oSource = oEvent.getSource(); // The UI control that triggered the event
            let id = oEvent.getSource().getId();
            let shortId = id.split("--").pop();

            if (oEvent.getParameter("removedTokens")[0]) {
                var text = oEvent.getParameter("removedTokens")[0].getKey();        //getText();
                switch (shortId) {
                    case "IdLIFNR":
                        aIdLIFNR = aIdLIFNR.filter(function (linea) {
                            return linea !== text;
                        });
                        break;
                    case "IdPSPNR":
                        aIdPSPNR = aIdPSPNR.filter(function (linea) {
                            return linea !== text;
                        });
                        aIdCONTRA = aIdCONTRA.filter(function (linea) {
                            return linea !== text;
                        });
                        var oMultiInput = this.getView().byId("ID_CON");
                        oMultiInput.removeAllTokens();
                        that._setLifnrDesc();
                        this.onEnableFollow(false);
                        break;
                    case "ID_CON":
                        aIdCONTRA = aIdCONTRA.filter(function (linea) {
                            return linea !== text;
                        });
                        that._setLifnrDesc();
                        break;
                    default:
                        // Code to execute if no cases match
                        break;
                }
            }
            if (oEvent.getParameter("addedTokens")[0]) {
                var textAdded = oEvent.getParameter("addedTokens")[0].getKey();
                switch (shortId) {
                    case "IdLIFNR":
                        aIdLIFNR.push(textAdded);
                        break;
                    case "IdPSPNR":
                        //add item to aIdPSPNR
                        aIdPSPNR.push(textAdded);
                        this._onQuery("RequirementProject");
                        this.onEnableFollow(true);

                        //clean aIdCONTRA
                        aIdCONTRA = aIdCONTRA.filter(function (linea) {
                            return linea !== text;
                        });
                        var oMultiInput = this.getView().byId("ID_CON");
                        oMultiInput.removeAllTokens();

                        //clean lifnr field
                        that._setLifnrDesc();

                        break;
                    case "ID_CON":
                        aIdCONTRA.push(textAdded);
                        var aSuggestionData = this.getView().getModel("serviceModel").getProperty("/generalContract");
                        var oObj = aSuggestionData.filter(oItem => oItem.ID_CON === textAdded);
                        that._setLifnrDesc(oObj[0].LIFNR, oObj[0].NAME1);
                        this._onQuery("ContratoAll");
                        break;
                    default:
                        // Code to execute if no cases match
                        break;
                }

            }

        },

        onAddReference: function (oEvent) {
            var that = this;
            var oSource = oEvent.getSource();
            const oTable = sap.ui.getCore().byId("idReferenceToTableRequeriment");
            const aSelectedItems = oTable.getSelectedItems(); // Obtiene las filas seleccionadas
            const oModel = this.getView().getModel("serviceModel");

            this.onValuesFields();
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            if (aJsonCreate === undefined) {
                aJsonCreate = [];
            }

            let oItemsArraylength, oPosI;
            if (Array.isArray(aJsonCreate.Items)) {
                oItemsArray = aJsonCreate.Items;
                oItemsArraylength = oItemsArray.length * 10;
            } else {
                oItemsArray = [];
                oItemsArraylength = 0;
            }

            var oLineStatus = this._getStatusObj(1);
            aSelectedItems.forEach((oItem) => {
                const oContext = oItem.getBindingContext("serviceModel");
                if (oContext) {
                    var data = oContext.getObject();

                    if (smodeId === "a") {
                        oItemsArraylength += 10;
                        oPosI = this.addLeadingZeros(oItemsArraylength, 4);
                    } else {
                        sMaxPos += 10;
                        oPosI = this.addLeadingZeros(sMaxPos, 4);
                    }

                    const oNewRow = {

                        EBELP: oPosI,
                        //ID_CON: data.ID_CON,
                        //CONPO: data.CONPO,
                        IMAG: (data.IMAGE) ? data.IMAGE : 'N/A',
                        IMAG_ENAB: (data.IMAGE) ? true : false,
                        IMAGE_SRC: host + "/ImageMaterial/" + data.MATNR,
                        MAT_MATNR: data.MATNR,
                        MAT_NAME: data.MATERIALNAME,
                        LINENAME: that._getLineText(data.MATNR, data.MATERIALNAME),
                        MENGE: data.MENGE,
                        QTY_AVA: that._getFormatValueQuantity(data.EBAN_AVAIL),
                        QTY_DELIV: that._getFormatValueQuantity(data.EBAN_AVAIL),
                        QTY_DELIV_COPY: that._getFormatValueQuantity(data.EBAN_AVAIL),
                        COMMENT: "",
                        MENGE_C: data.MENGE_C,
                        MEINS: data.MEINS,
                        RECEP_XDIFICA: false,
                        EINDT: currentDate.toISOString().split("T")[0],
                        CAT_ID: data.CAT_ID,
                        CAT_DESC: data.CAT_DESC,
                        CATEGORY: that._getLineText(data.CAT_ID, data.CAT_DESC),
                        FAM_ID: data.FAM_ID,
                        FAM_DESC: data.FAM_DESC,
                        FAMILY: that._getLineText(data.FAM_ID, data.FAM_DESC),
                        BRA_ID: data.BRA_ID,
                        BRA_DESC: data.BRA_DESC,
                        BRAND: that._getLineText(data.BRA_ID, data.BRA_DESC),
                        MOD_ID: data.MOD_ID,
                        MOD_DESC: data.MOD_DESC,
                        MODEL: that._getLineText(data.MOD_ID, data.MOD_DESC),
                        DIMENSIONS: data.MAT_DIMENS,
                        STANDARD_IND: (data.MAT_IND_STAN === "X") ? true : false,
                        IND_ACT_FIJO: (data.MAT_IND_ASSET === "X") ? true : false,
                        HERITAGE: (data.MAT_PATR === "X") ? true : false,
                        SPECIALS: true, //?
                        FFE: (data.MAT_FFE === "X") ? true : false,
                        DIV_ID: data.DIV_ID,
                        DIV_DESC: data.DIV_DESC,
                        DIVISION: that._getLineText(data.DIV_ID, data.DIV_DESC),
                        AREA_ID: data.AREA_ID,
                        AREA_DESC: data.AREA_DESC,
                        AREA: that._getLineText(data.AREA_ID, data.AREA_DESC),
                        LOCATION: data.UBICA,
                        SUBLOCATION: data.SUBIC,
                        REQ_SUMIN: data.SUMIN,
                        REQ_SUMIN_DESC: data.REQ_SUMIN_DESC,
                        SUPPLIED: that._getLineText(data.SUMIN, data.REQ_SUMIN_DESC),
                        REQ_VISTA: data.VISTA,
                        REQ_VISTA_DESC: data.REQ_VISTA_DESC,
                        VIEW: that._getLineText(data.VISTA, data.REQ_VISTA_DESC),

                        //pending
                        BANFN: data.BANFN,
                        BNFPO: data.BNFPO,
                        ERNAM: sUserName,
                        CREATION_NAME: sFName,
                        CREATION_LNAME: sLName,
                        CREATION_EMAIL: sEmail,

                        //New Line
                        LINE_STATUS: "N",
                        STATUS: 1,
                        STATUS_TEXT: oLineStatus.STATUS_TEXT,
                        STATUS_ICON: oLineStatus.STATUS_ICON,
                        STATUS_STATE: oLineStatus.STATUS_STATE
                    };
                    oItemsArray.push(oNewRow);
                }
            });

            //aJsonCreate[0].Items = oItemsArray;
            aJsonCreate["Items"] = oItemsArray;
            oModel.setProperty("/ScheduleLine", aJsonCreate);

            var oMainTable = this.byId("ItemsTable");
            oMainTable.removeSelections();
            this.onCloseDialog();
        },

        onAddContrat: function (oEvent) {
            var that = this;
            this.onValuesFields();
            aJsonCreate = oContractAll;
            const oModel = this.getView().getModel("serviceModel");
            let oItemsArraylength, oPosI;
            if (Array.isArray(aJsonCreate)) {
                //oItemsArray = aJsonCreate;
                oItemsArraylength = oItemsArray.length * 10;
            } else {
                oItemsArray = [];
                oItemsArraylength = 0;
            }

            var oLineStatus = this._getStatusObj(1);

            /*
            //Filtro solo items con cantidad disponible
            aJsonCreate = aJsonCreate.filter(function (oItem) {
                var bReturn = true;
                if (that.isNumeric(oItem.MENGE) && that.isNumeric(oItem.MENGE_C)) {
                    var iMenge = parseFloat(oItem.MENGE) - parseFloat(oItem.MENGE_C);
                    if (iMenge === 0) {
                        bReturn = false;
                    }
                }
                return bReturn;
            });
            */

            aJsonCreate.forEach((data) => {
                oItemsArraylength += 10;
                oPosI = this.addLeadingZeros(oItemsArraylength, 4);

                //Supplier
                if (data.LIFNR) {
                    that._setLifnrDesc(data.LIFNR, data.NAME1);
                }

                const oNewRow = {
                    EBELP: oPosI,
                    ID_CON: data.ID_CON,
                    CONAM: data.CONAM,
                    CONPO: data.CONPO,
                    IMAG: (data.IMAGE) ? data.IMAGE : 'N/A',
                    IMAG_ENAB: (data.IMAGE) ? true : false,
                    IMAGE_SRC: host + "/ImageMaterial/" + data.MAT_MATNR,
                    MAT_MATNR: data.MAT_MATNR,
                    MAT_NAME: data.MAT_NAME,
                    LINENAME: that._getLineText(data.MAT_MATNR, data.MAT_NAME),
                    MENGE: data.MENGE,
                    QTY_AVA: data.CONTR_AVAIL,
                    QTY_DELIV: data.CONTR_AVAIL,
                    QTY_DELIV_COPY: data.CONTR_AVAIL,
                    COMMENT: "",
                    MENGE_C: data.MENGE_C,
                    RECEP_XDIFICA: false,
                    EINDT: currentDate.toISOString().split("T")[0],
                    CAT_ID: data.CAT_ID,
                    CAT_DESC: data.CAT_DESC,
                    CATEGORY: that._getLineText(data.CAT_ID, data.CAT_DESC),
                    FAM_ID: data.FAM_ID,
                    FAM_DESC: data.FAM_DESC,
                    FAMILY: that._getLineText(data.FAM_ID, data.FAM_DESC),
                    BRA_ID: data.BRA_ID,
                    BRA_DESC: data.BRA_DESC,
                    BRAND: that._getLineText(data.BRA_ID, data.BRA_DESC),
                    MOD_ID: data.MOD_ID,
                    MOD_DESC: data.MOD_DESC,
                    MODEL: that._getLineText(data.MOD_ID, data.MOD_DESC),
                    DIMENSIONS: data.MAT_DIMENS,
                    STANDARD_IND: (data.MAT_IND_STAN === "X") ? true : false,
                    IND_ACT_FIJO: (data.MAT_IND_ASSET === "X") ? true : false,
                    HERITAGE: (data.MAT_PATR === "X") ? true : false,
                    SPECIALS: false, //?
                    FFE: (data.MAT_FFE === "X") ? true : false,
                    DIV_ID: data.DIV_ID,
                    DIV_DESC: data.DIV_DESC,
                    DIVISION: that._getLineText(data.DIV_ID, data.DIV_DESC),
                    AREA_ID: data.AREA_ID,
                    AREA_DESC: data.AREA_DESC,
                    AREA: that._getLineText(data.AREA_ID, data.AREA_DESC),
                    LOCATION: data.REQ_UBICA,
                    SUBLOCATION: data.REQ_SUBIC,
                    REQ_SUMIN: data.REQ_SUMIN,
                    REQ_SUMIN_DESC: data.REQ_SUMIN_DESC,
                    SUPPLIED: that._getLineText(data.REQ_SUMIN, data.REQ_SUMIN_DESC),
                    REQ_VISTA: data.REQ_VISTA,
                    REQ_VISTA_DESC: data.REQ_VISTA_DESC,
                    VIEW: that._getLineText(data.REQ_VISTA, data.REQ_VISTA_DESC),

                    MEINS: data.MAT_MEINS,

                    //pending
                    CONTR: data.EBELN,
                    CONPS: data.EBEL,
                    REQ_ID: data.REQ_ID,
                    REQ_ITEM: data.REQ_ITEM,
                    EINDT: currentDate.toISOString().split("T")[0],
                    ERNAM: sUserName,
                    CREATION_NAME: sFName,
                    CREATION_LNAME: sLName,
                    CREATION_EMAIL: sEmail,

                    //New Line
                    LINE_STATUS: "N",
                    STATUS: 1,
                    STATUS_TEXT: oLineStatus.STATUS_TEXT,
                    STATUS_ICON: oLineStatus.STATUS_ICON,
                    STATUS_STATE: oLineStatus.STATUS_STATE
                };
                oItemsArray.push(oNewRow);
            });
            oJsonCreate["Items"] = oItemsArray;
            oModel.setProperty("/ScheduleLine", oJsonCreate);
            oModel.refresh();
            this.byId("ItemsTable").setModel(oModel);
        },

        isNumeric: function (sStr) {
            return !isNaN(parseFloat(sStr)) && isFinite(sStr);
        },

        /*
        onAddContratEdit: function () {
            var that = this;
            this.onValuesFields();

            var aJsonEditCreate = oContractAll;
            const oModel = this.getView().getModel("serviceModel");
            var aEspecialData = oModel.getProperty("/RefEspecial");
            var aLoadItems = oContractItems.items;

            //Fecha de Recepción
            currentDate = new Date(oContractItems.DATETIME);
            this.byId("IdEINDTDatePicker").setValue(currentDate.toISOString().split("T")[0]);

            let oItemsArraylength, oPosI;
            if (Array.isArray(aJsonEditCreate)) {
                //oItemsArray = aJsonEditCreate;
                oItemsArraylength = oItemsArray.length * 10;
            } else {
                oItemsArray = [];
                oItemsArraylength = 0;
            }

            aJsonEditCreate.forEach((data) => {
                oItemsArraylength += 10;
                oPosI = this.addLeadingZeros(oItemsArraylength, 4);

                var linMat = aLoadItems.find(item => item.MATNR === data.MAT_MATNR && item.CONTR === data.EBELN && item.CONPS === data.EBEL);
                if (linMat) {
                    var oLineStatus = that._getStatusObj(parseInt(linMat.STATU));
                    const oNewRow = {
                        EBELP: linMat.EBELP,
                        ID_CON: data.ID_CON,
                        CONPO: data.CONPO,
                        IMAG: (data.IMAGE) ? data.IMAGE : 'N/A',
                        IMAG_ENAB: (data.IMAGE) ? true : false,
                        MAT_MATNR: data.MAT_MATNR,
                        MAT_NAME: linMat.MAT_NAME,
                        LINENAME: that._getLineText(data.MAT_MATNR, data.MAT_NAME),
                        MENGE: data.MENGE,
                        MEINS: data.MAT_MEINS,
                        QTY_DELIV: linMat.WEMNG,
                        RECEP_XDIFICA: false,
                        EINDT: linMat.EINDT,
                        CAT_ID: data.CAT_ID,
                        CAT_DESC: data.CAT_DESC,
                        CATEGORY: that._getLineText(data.CAT_ID, data.CAT_DESC),
                        FAM_ID: data.FAM_ID,
                        FAM_DESC: data.FAM_DESC,
                        FAMILY: that._getLineText(data.FAM_ID, data.FAM_DESC),
                        BRA_ID: data.BRA_ID,
                        BRA_DESC: data.BRA_DESC,
                        BRAND: that._getLineText(data.BRA_ID, data.BRA_DESC),
                        MOD_ID: data.MOD_ID,
                        MOD_DESC: data.MOD_DESC,
                        MODEL: that._getLineText(data.MOD_ID, data.MOD_DESC),
                        DIMENSIONS: data.MAT_DIMENS,
                        STANDARD_IND: (data.MAT_IND_STAN === "X") ? true : false,
                        IND_ACT_FIJO: (data.MAT_IND_ASSET === "X") ? true : false,
                        HERITAGE: (data.MAT_PATR === "X") ? true : false,
                        SPECIALS: false, //?
                        FFE: (data.MAT_FFE === "X") ? true : false,
                        DIV_ID: data.DIV_ID,
                        DIV_DESC: data.DIV_DESC,
                        DIVISION: that._getLineText(data.DIV_ID, data.DIV_DESC),
                        AREA_ID: data.AREA_ID,
                        AREA_DESC: data.AREA_DESC,
                        AREA: that._getLineText(data.AREA_ID, data.AREA_DESC),
                        LOCATION: data.REQ_UBICA,
                        SUBLOCATION: data.REQ_SUBIC,
                        REQ_SUMIN: data.REQ_SUMIN,
                        REQ_SUMIN_DESC: data.REQ_SUMIN_DESC,
                        SUPPLIED: that._getLineText(data.REQ_SUMIN, data.REQ_SUMIN_DESC),
                        REQ_VISTA: data.REQ_VISTA,
                        REQ_VISTA_DESC: data.REQ_VISTA_DESC,
                        VIEW: that._getLineText(data.REQ_VISTA, data.REQ_VISTA_DESC),
                        STATU: linMat.STATU,
                        STATUS: linMat.STATU,
                        STATUS_TEXT: oLineStatus.STATUS_TEXT,
                        STATUS_ICON: oLineStatus.STATUS_ICON,
                        STATUS_STATE: oLineStatus.STATUS_STATE,

                        //MENGE: data.ANTIC1 + data.ANTIC2 + data.ANTIC3 + data.ANTIC4 + data.ANTIC5,
                        MEINS: data.MAT_MEINS,

                        //pending
                        CONTR: data.EBELN,
                        CONPS: data.EBEL,
                        ERNAM: linMat.ERNAM,
                        CREATION_NAME: sFName,
                        CREATION_LNAME: sLName,
                        CREATION_EMAIL: sEmail,

                        //Line Exist
                        LINE_STATUS: "E"
                    };
                    oItemsArray.push(oNewRow);
                }
            });

            //Agrego items especiales
            var aFullData = oItemsArray.concat(aEspecialData);

            //Max Position of Array
            sMaxPos = Math.max(...aFullData.map(oObj => oObj.EBELP));
            sOrgMaxPos = sMaxPos;

            aDelPos = aFullData.filter(function (oItem) {
                return oItem.STATU === "2";
            });

            
            //var aIncludeItems = aFullData.filter(function (oItem) {
            //    return oItem.STATU !== "2";
            //});
         
            //only undeleted items
            //oItemsArray = aIncludeItems;
        

            oItemsArray = aFullData;

            //sort by EBELP
            oItemsArray.sort((a, b) => a.EBELP - b.EBELP);

            oJsonCreate["Items"] = oItemsArray;

            oModel.setProperty("/ScheduleLine", oJsonCreate);
            oModel.refresh();
            this.byId("ItemsTable").setModel(oModel);

            //title props
            this._setViewProperties(oContractItems);
        },
        */

        onAddContratEdit: function () {
            var that = this;
            this.onValuesFields();

            var aJsonEditCreate = oContractAll;
            const oModel = this.getView().getModel("serviceModel");
            var aEspecialData = oModel.getProperty("/RefEspecial");
            var aLoadItems = oContractItems.items;

            //Fecha de Recepción
            currentDate = new Date(oContractItems.DATETIME);
            //this.byId("IdEINDTDatePicker").setValue(currentDate.toISOString().split("T")[0]);

            let oItemsArraylength, oPosI;
            if (Array.isArray(aJsonEditCreate)) {
                //oItemsArray = aJsonEditCreate;
                oItemsArraylength = oItemsArray.length * 10;
            } else {
                oItemsArray = [];
                oItemsArraylength = 0;
            }

            //Obtento recepcion de materiales en caso de que previamente fuesen registradas 
            var aReceptMat = this.aReceptMaterials;

            aLoadItems.forEach((data) => {
                oItemsArraylength += 10;
                oPosI = this.addLeadingZeros(oItemsArraylength, 4);
                if (data.CONTR && data.CONPS) {


                    //Verifico recepcion de material
                    var sQTY_DELIV_COPY = that._getFormatValueQuantity(data.WEMNG);
                    var sCOMMENT = "";
                    var sRESERVED_QTY_DELIV = that._getFormatValueQuantity(0);
                    var bRecep = false;
                    var oRecep = aReceptMat.find(item => item.PROGP === data.EBELP);
                    if (oRecep) {
                        sQTY_DELIV_COPY = oRecep.ERFMG;
                        sRESERVED_QTY_DELIV = oRecep.ERFMG;
                        sCOMMENT = oRecep.TEXT1;
                        bRecep = true;
                    }
                    //Verifico recepcion de material

                    var oLineStatus = that._getStatusObj(parseInt(data.STATU));
                    const oNewRow = {
                        EBELP: data.EBELP,
                        ID_CON: data.ID_CON,
                        CONPO: data.CONPO,
                        IMAG: (data.IMAGE) ? data.IMAGE : 'N/A',
                        IMAG_ENAB: (data.IMAGE) ? true : false,
                        IMAGE_SRC: host + "/ImageMaterial/" + data.MATNR,
                        MAT_MATNR: data.MATNR,
                        MAT_NAME: data.MAT_NAME,
                        LINENAME: that._getLineText(data.MATNR, data.MAT_NAME),

                        //Quantity
                        MENGE: data.MENGE,
                        QTY_AVA: that._getFormatValueQuantity(data.CONTR_AVAIL),
                        QTY_DELIV: that._getFormatValueQuantity(data.WEMNG),
                        QTY_DELIV_COPY: sQTY_DELIV_COPY,
                        RESERVED_QTY_DELIV: sRESERVED_QTY_DELIV,
                        B_RESERVED: bRecep,
                        COMMENT: sCOMMENT,
                        MENGE_C: data.MENGE_C,
                        RESERVED_MENGE: that._getFormatValueQuantity(data.WEMNG),
                        MEINS: data.MEINS,

                        RECEP_XDIFICA: false,
                        EINDT: data.EINDT,
                        CAT_ID: data.CAT_ID,
                        CAT_DESC: data.CAT_DESC,
                        CATEGORY: that._getLineText(data.CAT_ID, data.CAT_DESC),
                        FAM_ID: data.FAM_ID,
                        FAM_DESC: data.FAM_DESC,
                        FAMILY: that._getLineText(data.FAM_ID, data.FAM_DESC),
                        BRA_ID: data.BRA_ID,
                        BRA_DESC: data.BRA_DESC,
                        BRAND: that._getLineText(data.BRA_ID, data.BRA_DESC),
                        MOD_ID: data.MOD_ID,
                        MOD_DESC: data.MOD_DESC,
                        MODEL: that._getLineText(data.MOD_ID, data.MOD_DESC),
                        DIMENSIONS: data.MAT_DIMENS,
                        STANDARD_IND: (data.MAT_IND_STAN === "X") ? true : false,
                        IND_ACT_FIJO: (data.MAT_IND_ASSET === "X") ? true : false,
                        HERITAGE: (data.MAT_PATR === "X") ? true : false,
                        SPECIALS: false, //?
                        FFE: (data.MAT_FFE === "X") ? true : false,
                        DIV_ID: data.DIV_ID,
                        DIV_DESC: data.DIV_DESC,
                        DIVISION: that._getLineText(data.DIV_ID, data.DIV_DESC),
                        AREA_ID: data.AREA_ID,
                        AREA_DESC: data.AREA_DESC,
                        AREA: that._getLineText(data.AREA_ID, data.AREA_DESC),
                        LOCATION: data.EBAN_UBICA,
                        SUBLOCATION: data.REQ_SUBIC, //--falta
                        REQ_SUMIN: data.EBAN_SUMIN,
                        REQ_SUMIN_DESC: data.REQ_SUMIN_DESC,
                        SUPPLIED: that._getLineText(data.EBAN_SUMIN, data.REQ_SUMIN_DESC),
                        REQ_VISTA: data.EBAN_VISTA,
                        REQ_VISTA_DESC: data.REQ_VISTA_DESC,
                        VIEW: that._getLineText(data.EBAN_VISTA, data.REQ_VISTA_DESC),
                        STATU: data.STATU,
                        STATUS: data.STATU,
                        STATUS_TEXT: oLineStatus.STATUS_TEXT,
                        STATUS_ICON: oLineStatus.STATUS_ICON,
                        STATUS_STATE: oLineStatus.STATUS_STATE,

                        //MENGE: data.ANTIC1 + data.ANTIC2 + data.ANTIC3 + data.ANTIC4 + data.ANTIC5,
                        //MEINS: data.MAT_MEINS,

                        //pending
                        CONTR: data.CONTR,
                        CONPS: data.CONPS,
                        REQ_ID: data.BANFN,
                        REQ_ITEM: data.BNFPO,
                        ERNAM: data.ERNAM,
                        CREATION_NAME: sFName,
                        CREATION_LNAME: sLName,
                        CREATION_EMAIL: sEmail,

                        EBELN_MAT: data.EBELN,
                        EBELP_MAT: data.EBELP,

                        //Line Exist
                        LINE_STATUS: "E"
                    };
                    oItemsArray.push(oNewRow);
                }
            });

            //Agrego items especiales
            var aFullData = oItemsArray.concat(aEspecialData);

            //Max Position of Array
            sMaxPos = Math.max(...aFullData.map(oObj => oObj.EBELP));
            sOrgMaxPos = sMaxPos;


            //aDelPos = aFullData.filter(function (oItem) {
            //    return oItem.STATU === "2";
            //});


            //var aIncludeItems = aFullData.filter(function (oItem) {
            //    return oItem.STATU !== "2";
            //});

            //only undeleted items
            //oItemsArray = aIncludeItems;

            oItemsArray = aFullData;

            //sort by EBELP
            oItemsArray.sort((a, b) => a.EBELP - b.EBELP);

            oJsonCreate["Items"] = oItemsArray;

            oModel.setProperty("/ScheduleLine", oJsonCreate);
            oModel.refresh();
            this.byId("ItemsTable").setModel(oModel);

            //title props
            this._setViewProperties(oContractItems);
        },

        //Return line text
        _getLineText: function (sId, sDesc) {
            if (sId && sDesc) {
                return sDesc;
            } else if (sDesc) {
                return sDesc;
            } else if (sId) {
                return sId;
            } else {
                return "";
            }
        },

        _getLineTest: function (sId) {
            return {
                "ID_CON": "1000",
                "CONPO": 10,
                "KDATB": "TST_" + sId,
                "KDATE": "TST_" + sId,
                "ANTIC1": "TST_" + sId,
                "ADAT1": "TST_" + sId,
                "ANTIC2": "TST_" + sId,
                "ADAT2": "TST_" + sId,
                "ANTIC3": "TST_" + sId,
                "ADAT3": "TST_" + sId,
                "ANTIC4": "TST_" + sId,
                "ADAT4": "TST_" + sId,
                "ANTIC5": "TST_" + sId,
                "ADAT5": "TST_" + sId,
                "ERNAM": "ERNAM",
                "ERDAT": "2024-01-01",
                "MODIF": "MODIF",
                "MODAT": "2024-01-01",
                "ESTAT": "TST_" + sId,
                "EBELN": "TST_" + sId,
                "EBEL": "TST_" + sId,
                "MPAG1": "TST_" + sId,
                "MPAG2": "TST_" + sId,
                "MPAG3": "TST_" + sId,
                "MPAG4": "TST_" + sId,
                "MPAG5": "TST_" + sId,
                "MPAGO": "TST_" + sId,
                "MPFALT": "TST_" + sId,
                "MPMX1": "TST_" + sId,
                "MPMX2": "TST_" + sId,
                "MPMX3": "TST_" + sId,
                "MPMX4": "TST_" + sId,
                "MPMX5": "TST_" + sId,
                "MPAMX": "TST_" + sId,
                "MFMX": "TST_" + sId,
                "MENGE": "TST_" + sId,
                "MENGE_C": "TST_" + sId,
                "CONAM": "10",
                "PSPNR": "TST_" + sId,
                "QUO_MEINS": "TST_" + sId,
                "REQ_ID": "TST_" + sId,
                "REQ_ITEM": "TST_" + sId,
                "REQ_MENGE": "TST_" + sId,
                "MAT_MATNR": "TST_" + sId,
                "MAT_NAME": "TST_" + sId,
                "REQ_MENGE_C": "TST_" + sId,
                "MAT_MEINS": "TST_" + sId,
                "CAT_ID": "TST_" + sId,
                "CAT_DESC": "TST_" + sId,
                "FAM_ID": "TST_" + sId,
                "FAM_DESC": "TST_" + sId,
                "BRA_ID": "TST_" + sId,
                "BRA_DESC": "TST_" + sId,
                "MOD_ID": "TST_" + sId,
                "MOD_DESC": "TST_" + sId,
                "MAT_DIMENS": "TST_" + sId,
                "MAT_IND_STAN": "TST_" + sId,
                "MAT_IND_ASSET": "TST_" + sId,
                "MAT_PATR": "TST_" + sId,
                "MAT_FFE": "TST_" + sId,
                "DIV_ID": "TST_" + sId,
                "DIV_DESC": "TST_" + sId,
                "AREA_ID": "TST_" + sId,
                "AREA_DESC": "TST_" + sId,
                "REQ_UBICA": "TST_" + sId,
                "REQ_SUBIC": "TST_" + sId,
                "REQ_SUMIN": "TST_" + sId,
                "REQ_SUMIN_DESC": "",
                "REQ_VISTA": "TST_" + sId,
                "REQ_VISTA_DESC": "",
                "LIFNR": "TST_" + sId,
                "NAME1": "TST_" + sId,
                "CREATION_NAME": "TST_" + sId,
                "CREATION_LNAME": "TST_" + sId,
                "CREATION_EMAIL": "TST_" + sId,
                "MODIFY_NAME": "TST_" + sId,
                "MODIFY_LNAME": "TST_" + sId,
                "MODIFY_EMAIL": "TST_" + sId
            };
        },

        onValuesFields: function (oEvent) {
            let idProy, proyName, idCont, contraName, idSup, supName;
            const oModel = this.getView().getModel("serviceModel");
            var oMultiInput = this.getView().byId("IdPSPNR");
            var aTokens = oMultiInput.getTokens();
            aTokens.forEach(function (oToken) {
                idProy = oToken.getKey();
                proyName = oToken.getText();
            });
            oJsonCreate[0].ID_PEP = idProy;
            oJsonCreate[0].PSPNR = idProy;
            oJsonCreate[0].PROJ_NAME = proyName;
            oJsonCreate[0].STATUS = 1;

            if (smodeId === "a") {
                oJsonCreate[0].ERNAM = sUserName;
            }

            var oMultiInput = this.getView().byId("ID_CON");
            var aTokens = oMultiInput.getTokens();
            aTokens.forEach(function (oToken) {
                idCont = oToken.getKey();
                contraName = oToken.getText();
            });
        },

        ///////////////////////////////// End Create dialog table Reference ////////////////////////////////////////////
        /////////Event Buttons
        onDateChange: function (oEvent) {
            var oDatePicker = oEvent.getSource();
            currentDate = oDatePicker.getDateValue();
        },
        onSwitchChange: function (oEvent) {
            // Obtener el estado del switch (true o false)
            let bState = oEvent.getParameter("state");
            let sValue = bState ? "X" : null;
            let oModel = this.getView().getModel("detailModel");
            oModel.setProperty("/generalDataDetail/LOEKZ", sValue);
        },

        onValidateSwitchLOEKZ: function (oHeaderStatus, aItems) {
            var bHeaderValid = oHeaderStatus === "1" || oHeaderStatus === "2";
            var bItemValid = aItems.some(item => item.CONF === "1" || item.CONF === "2");
            if (bHeaderValid && bItemValid) {
                inputsFields.push("switchLOEKZ");
            }
        },

        onEnableFollow: function (state) {
            this.byId("ID_CON").setEnabled(state);
            this.byId("idBttonReference").setEnabled(state);
        },

        onEditFields: function (state, sMode) {
            var oGlobalModel = this.getView().getModel("globalModel");
            oGlobalModel.setProperty("/enabled", state);
            oGlobalModel.setProperty("/enabled_d", state);
            oGlobalModel.refresh();
            oEditstatus = state;

            // --- GESTIÓN DE BOTONES DE EDICIÓN (SOLO HABILITACIÓN) ---
            // La visibilidad se maneja por roles, solo controlamos enabled/disabled
            // NOTA: El botón "Editar" solo se inhabilita por conflictos de sesión, no por cambio de modo
            if (state) {
                // Habilitar edición: botones de guardar/cancelar habilitados
                this.byId("idBtnSave").setEnabled(true);  // Guardar habilitado
                this.byId("idBtnCancel").setEnabled(true); // Cancelar habilitado
                // El botón "Editar" mantiene su estado actual (no se modifica aquí)
            } else {
                // Deshabilitar edición: botones de guardar/cancelar deshabilitados
                this.byId("idBtnSave").setEnabled(false); // Guardar deshabilitado
                this.byId("idBtnCancel").setEnabled(false); // Cancelar deshabilitado
                // El botón "Editar" mantiene su estado actual (no se modifica aquí)
            }

            if (sMode === "a") {
                var oGlobalModel = this.getView().getModel("globalModel");
                oGlobalModel.setProperty("/xdifica", false);
            }
        },

        // --- GESTIÓN ESPECÍFICA DEL BOTÓN EDITAR ---
        // Esta función solo se llama cuando hay conflictos de sesión
        _setEditButtonState: function(enabled, reason) {
            const oBtnEdit = this.byId("idBtnEdit");
            if (oBtnEdit) {
                oBtnEdit.setEnabled(enabled);
                if (!enabled) {
                    console.log(`🔒 Botón Editar inhabilitado: ${reason}`);
                } else {
                    console.log(`✅ Botón Editar habilitado: ${reason}`);
                }
            }
        },

        ////////////////////////////////////////////////Begin functionlaity buttons//////////////////////////////////////

        onEditFieldsBtn: async function (oEvent) {
            // Verificar si estamos en modo offline
            if (!window.navigator.onLine) {
                // Modo offline: funcionalidad existente sin gestión de sesiones
                console.log("📱 Modo offline: Funcionalidad de edición sin gestión de sesiones");
                var bXdifica = this._getXdificaIndicator();
                this.onEditFields(true);
                this.byId("idBttonReference").setEnabled(true);
                var oGlobalModel = this.getView().getModel("globalModel");
                oGlobalModel.setProperty("/xdifica", bXdifica);
                var smg1 = oBuni18n.getText("EDIT_MSG");
                sap.m.MessageToast.show(smg1);
                return;
            }

            // Modo online: gestión de sesiones
            console.log("🌐 Modo online: Iniciando gestión de sesiones");
            await this.onEditFieldsOnline();
        },

        // Función para gestión de sesiones en modo online
        onEditFieldsOnline: async function () {
            var oGlobalModel = this.getView().getModel("globalModel");
            var oServiceModel = this.getView().getModel("serviceModel");
            var oBuni18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();

            // Debug: Verificar estado del modelo antes de crear sesión
            const oModel = this.getView().getModel("serviceModel");
            const oScheduleLine = oModel.getProperty("/ScheduleLine");
            console.log("🔍 Estado del modelo antes de crear sesión:");
            console.log("🔍 sObjectId:", sObjectId);
            console.log("🔍 ScheduleLine en modelo:", oScheduleLine);
            console.log("🔍 EBELN disponible:", oScheduleLine?.EBELN);

            // --- GESTIÓN DE SESIONES: VERIFICACIÓN ANTES DE EDITAR ---
            try {
                // Verificar si el documento ya está bloqueado antes de intentar crear sesión
                const sessionBlocked = await Services.GetSession(this, sObjectId);
                if (sessionBlocked) {
                    // Documento ya está bloqueado, verificar si es por el usuario actual
                    const oSession = oServiceModel.getProperty("/Session") || {};
                    const currentUser = Users.getUserInfo();
                    const sessionUser = oSession.ERNAM;
                    
                    console.log("🔍 Verificación de bloqueo:");
                    console.log("🔍 Usuario actual:", currentUser.sUserId);
                    console.log("🔍 Usuario de sesión:", sessionUser);
                    console.log("🔍 ¿Es el mismo usuario?", currentUser.sUserId === sessionUser);
                    
                    // Solo bloquear si es un usuario diferente
                    if (currentUser.sUserId !== sessionUser) {
                        // Documento bloqueado por otro usuario
                        // Extraer nombre del ERNAM híbrido para el modelo global
                        this._showBlockedMessageFromHybridERNAMGlobal(oSession.ERNAM);
                        this._setEditButtonState(false, "Documento bloqueado por otro usuario al intentar editar");
                        this.onEditFields(false, smodeId);
                        return; // Prevenir edición
                    } else {
                        // Es el mismo usuario, continuar con la edición
                        console.log("✅ Documento bloqueado por el usuario actual, continuando con edición");
                    }
                }

                // Limpiar sesión existente si existe
                try {
                    const oModel = this.getView().getModel("serviceModel");
                    const oDoc = oModel.getProperty("/ScheduleLine") || {};
                    const sDocId = oDoc.EBELN || this.sObjMBLRN || sObjectId;
                    
                    if (sDocId && sDocId !== "New") {
                        console.log("🧹 Limpiando sesión existente antes de crear nueva:", sDocId);
                        await Services.DeleteSession(sDocId);
                    }
                } catch (e) {
                    console.warn("⚠️ Advertencia al limpiar sesión existente:", e);
                }
                
                // Intenta crear la sesión/lock
                try {
                    console.log("🔐 Intentando crear sesión para documento:", sObjectId);
                    
                    // Validar que CreateSession retorne datos válidos
                    const sessionData = Json.CreateSession(this, sObjectId);
                    if (!sessionData) {
                        console.error("❌ No se pudo crear datos de sesión");
                        oGlobalModel.setProperty("/messageStripText", "Error: No se pudo crear la sesión. Verifique los datos del documento.");
                        this.onEditFields(false, smodeId);
                        return;
                    }
                    
                    console.log("📋 Datos de sesión a enviar:", sessionData);
                    const sessionCreated = await Services.PostSession(this, sessionData);
                    
                    if (sessionCreated && sessionCreated.length > 0) {
                        // Lock exitoso: permite edición y comienza a renovar lock
                        console.log("✅ Sesión creada exitosamente:", sessionCreated);
                        
                        if (this._sessionInterval) {
                            clearInterval(this._sessionInterval);
                            this._sessionInterval = null;
                        }
                        
                        this._sessionInterval = setInterval(async () => {
                            try {
                                // 1. Verificar primero si la sesión aún existe en la base de datos
                                const sessionExists = await Services.GetSession(this, sObjectId);
                                if (!sessionExists) {
                                    console.log("🔄 Sesión ya no existe en la base de datos, deteniendo intervalo");
                                    clearInterval(this._sessionInterval);
                                    this._sessionInterval = null;
                                    this.onEditFields(false, smodeId);
                                    return;
                                }
                                
                                // 2. Validar que UpdateSession retorne datos válidos
                                const updateData = Json.UpdateSession(this, sObjectId);
                                if (!updateData) {
                                    console.error("❌ No se pudo crear datos de actualización de sesión");
                                    clearInterval(this._sessionInterval);
                                    this._sessionInterval = null;
                                    this.onEditFields(false, smodeId);
                                    return;
                                }
                                
                                // 3. Actualizar la sesión
                                const result = await Services.UpdateSession(this, updateData);
                                if (!result || result.error) {
                                    // Sesión expiró o hay error, limpiar y deshabilitar edición
                                    console.warn("⚠️ Sesión expiró o error en actualización:", result);
                                    clearInterval(this._sessionInterval);
                                    this._sessionInterval = null;
                                    this.onEditFields(false, smodeId);
                                    
                                    // Mostrar mensaje al usuario
                                    oGlobalModel.setProperty("/messageStripText", oBuni18n.getText("SESSION_TIMEOUT_MESSAGE"));
                                } else {
                                    console.log("🔄 Sesión renovada exitosamente");
                                }
                            } catch (e) {
                                console.error("❌ Error actualizando sesión:", e);
                                // En caso de error, limpiar intervalo y deshabilitar edición
                                clearInterval(this._sessionInterval);
                                this._sessionInterval = null;
                                this.onEditFields(false, smodeId);
                            }
                        }, this.SESSION_UPDATE_INTERVAL);
                        
                        // Continuar con la lógica original de edición
                        var bXdifica = this._getXdificaIndicator();
                        this.onEditFields(true);
                        this.byId("idBttonReference").setEnabled(true);
                        oGlobalModel.setProperty("/xdifica", bXdifica);
                        oGlobalModel.setProperty("/messageStripText", ""); // Limpia mensaje de bloqueo
                        // El botón Editar se mantiene habilitado (no se modifica aquí)
                        
                        // --- INICIAR RENOVACIÓN PERIÓDICA DE SESIÓN ---
                        if (this._sessionInterval) {
                            clearInterval(this._sessionInterval);
                            this._sessionInterval = null;
                        }

                        this._sessionInterval = setInterval(async () => {
                            try {
                                console.log("🔄 Renovando sesión periódicamente...");
                                
                                // 1. Verificar primero si la sesión aún existe en la base de datos
                                const sessionExists = await Services.GetSession(this, sObjectId);
                                if (!sessionExists) {
                                    console.log("🔄 Sesión ya no existe en la base de datos, deteniendo intervalo");
                                    clearInterval(this._sessionInterval);
                                    this._sessionInterval = null;
                                    this.onEditFields(false, smodeId);
                                    return;
                                }

                                // 2. Validar que UpdateSession retorne datos válidos
                                const updateData = Json.UpdateSession(this, sObjectId);
                                if (!updateData) {
                                    console.error("❌ No se pudo crear datos de actualización de sesión");
                                    clearInterval(this._sessionInterval);
                                    this._sessionInterval = null;
                                    this.onEditFields(false, smodeId);
                                    return;
                                }

                                // 3. Actualizar la sesión
                                const result = await Services.UpdateSession(this, updateData);
                                if (!result || result.error) {
                                    // Sesión expiró o hay error, limpiar y deshabilitar edición
                                    console.warn("⚠️ Sesión expiró o error en actualización:", result);
                                    clearInterval(this._sessionInterval);
                                    this._sessionInterval = null;
                                    this.onEditFields(false, smodeId);

                                    // Mostrar mensaje al usuario
                                    oGlobalModel.setProperty("/messageStripText", oBuni18n.getText("SESSION_EXPIRED"));
                                } else {
                                    console.log("🔄 Sesión renovada exitosamente");
                                    // Opcional: mostrar mensaje de éxito
                                    // oGlobalModel.setProperty("/messageStripText", oBuni18n.getText("SESSION_RENEWED"));
                                }
                            } catch (e) {
                                console.error("❌ Error actualizando sesión:", e);
                                // En caso de error, limpiar intervalo y deshabilitar edición
                                clearInterval(this._sessionInterval);
                                this._sessionInterval = null;
                                this.onEditFields(false, smodeId);
                                
                                // Mostrar mensaje de error
                                oGlobalModel.setProperty("/messageStripText", oBuni18n.getText("SESSION_UPDATE_ERROR"));
                            }
                        }, this.SESSION_UPDATE_INTERVAL);
                        
                        var smg1 = oBuni18n.getText("EDIT_MSG");
                        sap.m.MessageToast.show(smg1);
                        
                    } else {
                        // Lock fallido: muestra mensaje y NO habilita edición
                        console.warn("⚠️ No se pudo crear sesión:", sessionCreated);
                        const oSession = oServiceModel.getProperty("/Session") || {};
                        // Extraer nombre del ERNAM híbrido para el modelo global
                        this._showBlockedMessageFromHybridERNAMGlobal(oSession.ERNAM);
                        this.onEditFields(false, smodeId);
                    }
                    
                } catch (e) {
                    console.error("❌ Error en la gestión de sesiones:", e);
                    oGlobalModel.setProperty("/messageStripText", "Error: No se pudo procesar la solicitud de edición. Intente nuevamente.");
                    this.onEditFields(false, smodeId);
                }
                
            } catch (e) {
                console.error("❌ Error en la gestión de sesiones:", e);
                oGlobalModel.setProperty("/messageStripText", "Error: No se pudo procesar la solicitud de edición. Intente nuevamente.");
                this.onEditFields(false, smodeId);
            }
        },

        _getXdificaIndicator: function () {
            //XDIFICA ROL
            var bValidXdifica = false;
            var oModel = this.getView().getModel("serviceModel");
            var aXdifica = oModel.getProperty("/generalRolXdifica");
            if (aXdifica) {
                if (aXdifica.length > 0) {
                    bValidXdifica = aXdifica[0].CREATE === "X" ? true : false;
                }
            }
            return bValidXdifica;
        },

        _create: function (oEvent) {
            var bValid = this._getValidPayload();
            if (bValid) {
                var bValidMenge = this._getValidItems();
                if (bValidMenge) {
                    var that = this;
                    sap.ui.core.BusyIndicator.show();
                    setTimeout(function () {
                        //if (that._validaDisponibilidad()) {
                        that._postItems(oEvent);
                        //} else {
                        //sap.ui.core.BusyIndicator.hide();
                        //}
                    }, 50);
                }
            }
        },

        _validaDisponibilidad: function () {
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            var aItems = this._getLinesTable(aJsonCreate, "", true);
            var bContract = this._getActualContractLines(aItems);
            var bEspecial = this._getActualEspecialLines(aItems);
            if (bContract && bEspecial) {
                return true;
            } else {
                sap.ui.core.BusyIndicator.hide();
                return false;
            }
        },

        _getActualContractLines: function (aItems) {
            let sID = aIdCONTRA[0];
            let sIDPSPNR = aIdPSPNR[0];
            let bReturn = true;
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");

            if (sID && sIDPSPNR) {
                let url = `${host}/ContractItemsFromScheduleLine?$filter=EKKO.PSPNR EQ '${sIDPSPNR}' AND ID_CON EQ '${sID}'`;
                var aResponse = this.getDataRangesSynchronously(url);
                var aData = { result: [] };
                if (aResponse.result) {
                    if (aResponse.result.length > 0) {
                        aData.result = aResponse.result;
                    }
                }

                for (var i = 0; i < aItems.length; i++) {
                    var bValid = false;
                    let linMat = aData.result.find(item => item.MAT_MATNR === aItems[i].MATNR && item.EBELN === aItems[i].CONTR && item.EBEL === aItems[i].CONPS);
                    if (linMat) {
                        bValid = true;
                        linMat.CONTR_AVAIL = linMat.CONTR_AVAIL ? linMat.CONTR_AVAIL : 0;
                        let iAvail = parseFloat(linMat.CONTR_AVAIL);
                        let iQty = 0;
                        if (smodeId === "a") {
                            iQty = parseFloat(aItems[i].WEMNG);
                        } else {
                            var iReserved = aItems[i].RESERVED_MENGE ? aItems[i].RESERVED_MENGE : 0;
                            iQty = parseFloat(aItems[i].WEMNG) - parseFloat(iReserved);
                        }

                        //let oTableItem = aJsonCreate.Items.find(item => item.MAT_MATNR === aItems[i].MATNR && item.CONTR === aItems[i].CONTR && item.CONPS === aItems[i].CONPS);
                        //if (oTableItem) {
                        //oTableItem.MENGE = linMat.MENGE;
                        //oTableItem.QTY_AVA = linMat.CONTR_AVAIL;
                        //oTableItem.MENGE_C = linMat.MENGE_C;
                        //}

                        if (iQty > iAvail) {
                            bReturn = false;
                            let Msn = oBuni18n.getText("NO_AVAIL", [aItems[i].EBELP, this._getFormatValueQuantity(iAvail)])
                            MessageBox.error(Msn);
                            break;
                        }
                    }

                    if (!bValid) {
                        if (aItems[i].CONTR && aItems[i].CONPS) {

                            let iQty = 0;
                            if (smodeId === "a") {
                                iQty = parseFloat(aItems[i].WEMNG);
                            } else {
                                var iReserved = aItems[i].RESERVED_MENGE ? aItems[i].RESERVED_MENGE : 0;
                                iQty = parseFloat(aItems[i].WEMNG) - parseFloat(iReserved);
                            }

                            if (iQty > 0) {
                                bReturn = false;
                                let Msn = oBuni18n.getText("NO_AVAIL", [aItems[i].EBELP, this._getFormatValueQuantity(0)])
                                MessageBox.error(Msn);
                                break;
                            }
                        }
                    }
                }
            }
            oModel.refresh();
            return bReturn;
        },

        _getActualEspecialLines: function (aItems) {
            let sProject = aIdPSPNR[0];
            let bReturn = true;
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            if (sProject) {
                let url = `${host}/RequirementSpecials/${sProject}`;
                var aResponse = this.getDataRangesSynchronously(url);
                var aData = { result: [] };
                if (aResponse.result) {
                    if (aResponse.result.length > 0) {
                        aData.result = aResponse.result;
                    }
                }

                for (var i = 0; i < aItems.length; i++) {
                    var bValid = false;
                    let linMat = aData.result.find(item => item.MATNR === aItems[i].MATNR && item.BANFN === aItems[i].BANFN && item.BNFPO === aItems[i].BNFPO);
                    if (linMat) {
                        bValid = true;
                        linMat.EBAN_AVAIL = linMat.EBAN_AVAIL ? linMat.EBAN_AVAIL : 0;
                        let iAvail = parseFloat(linMat.EBAN_AVAIL);
                        let iQty = 0;
                        if (smodeId === "a") {
                            iQty = parseFloat(aItems[i].WEMNG);
                        } else {
                            var iReserved = aItems[i].RESERVED_MENGE ? aItems[i].RESERVED_MENGE : 0;
                            iQty = parseFloat(aItems[i].WEMNG) - parseFloat(iReserved);
                        }

                        //let oTableItem = aJsonCreate.Items.find(item => item.MAT_MATNR === aItems[i].MATNR && item.BANFN === aItems[i].BANFN && item.BNFPO === aItems[i].BNFPO);
                        //if (oTableItem) {
                        //    oTableItem.MENGE = linMat.MENGE;
                        //    oTableItem.QTY_AVA = linMat.EBAN_AVAIL;
                        //    oTableItem.MENGE_C = linMat.MENGE_C;
                        //}

                        if (iQty > iAvail) {
                            bReturn = false;
                            let Msn = oBuni18n.getText("NO_AVAIL", [aItems[i].EBELP, this._getFormatValueQuantity(iAvail)])
                            MessageBox.error(Msn);
                            break;
                        }
                    }

                    if (!bValid) {
                        if (!aItems[i].CONTR && !aItems[i].CONPS) {

                            let iQty = 0;
                            if (smodeId === "a") {
                                iQty = parseFloat(aItems[i].WEMNG);
                            } else {
                                var iReserved = aItems[i].RESERVED_MENGE ? aItems[i].RESERVED_MENGE : 0;
                                iQty = parseFloat(aItems[i].WEMNG) - parseFloat(iReserved);
                            }

                            if (iQty > 0) {
                                bReturn = false;
                                let Msn = oBuni18n.getText("NO_AVAIL", [aItems[i].EBELP, this._getFormatValueQuantity(0)])
                                MessageBox.error(Msn);
                                break;
                            }

                        }
                    }
                }
            }
            oModel.refresh();
            return bReturn;
        },
        /*
        _postItems: async function (oEvent) {
            var that = this;
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            //if (smodeId === "a") {
            if (this.sModeUpdate === "c") {
                sValidateOnBack = true;
                var nsUrol = host + "/Ranges/query";
                var oResponse = this.getDataRangesSynchronously(nsUrol);
                var sMBLRN = "";
                if (oResponse) {
                    var oResult = oResponse.find(objectype => objectype.OBJECT === "RECEPALM");
                    if (Number(oResult['COUNT']) === 0) {
                        idProgAlmacen = Number(oResult['FROMNUMBER']);
                    } else {
                        idProgAlmacen = Number(oResult['COUNT']) + 1;
                    }
                    if (idProgAlmacen > Number(oResult['TONUMBER'])) {
                        MessageToast.show(oI18n.getResourceBundle().getText("rangeFinish"));
                        return;
                    }

                    sMBLRN = idProgAlmacen;
                }

                var oPayload = this._getPayload(sMBLRN);

                //try {
                let response = await fetch(host + `/MaterialDocument`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(oPayload)
                });
                let responseData = await response.json();
                if (!response.ok) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error(responseData.error);
                    return responseData;
                }
                if (response.status === 200) {
                    //this._postMENGE_C();
                    sap.ui.core.BusyIndicator.hide();
                    var oSUrl = host + "/Ranges/update/RECEPALM";
                    const oSData = { COUNT: idProgAlmacen };
                    this.updateDataCountRanges(oSUrl, oSData);
                    this.updateScheduleLineQuantity();
                    this.onUploadPhotos(sMBLRN); //upload images
                    this.onDeletePhotos(); //delete
                    var smg1 = oBuni18n.getText("msUpdated");
                    smg1 = smg1 + " " + idProgAlmacen;
                    MessageBox.success(smg1, {
                        onClose: function () {
                            that.onCancelEdit();
                        }
                    });
                    ///////////////////
                }

                return responseData;
                //} catch (error) {
                //    return { error: error.message };
                //}

            } else if (smodeId === "r" || smodeId === "c") {
                sValidateOnBack = true;
                this._update(oEvent);
            }
        },
        */
        // Offline
        _postItems: async function (oEvent) {
            var that = this;
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");

            // --- MANEJO OFFLINE ---
            if (!window.navigator.onLine) {
                sap.ui.require([
                    "com/xcaret/recepcionarticulosoff/model/indexedDBService"
                ], async function (indexedDBService) {
                    let opType = (that.sModeUpdate === "c") ? "create" : "update";
                    let oPayload, sMBLRN, sKey;

                    if (opType === "create") {
                        // Simula la obtención del MBLRN (programación almacén)
                        var nsUrol = host + "/Ranges/query";
                        var oResponse = that.getDataRangesSynchronously(nsUrol);
                        if (oResponse) {
                            var oResult = oResponse.find(objectype => objectype.OBJECT === "RECEPALM");
                            if (Number(oResult['COUNT']) === 0) {
                                idProgAlmacen = Number(oResult['FROMNUMBER']);
                            } else {
                                idProgAlmacen = Number(oResult['COUNT']) + 1;
                            }
                            if (idProgAlmacen > Number(oResult['TONUMBER'])) {
                                MessageToast.show(oBuni18n.getResourceBundle().getText("rangeFinish"));
                                sap.ui.core.BusyIndicator.hide();
                                return;
                            }
                            sMBLRN = idProgAlmacen;
                        }
                        oPayload = that._getPayload(sMBLRN);
                        sKey = "TEMP_" + Date.now(); // <-- temporal para creación
                    } else {
                        // Update: usa SIEMPRE el MBLRN real como clave
                        let oViewObj = that.oReceptMaterialsHeader;
                        oPayload = that._getPayloadUpdate(oViewObj);
                        sMBLRN = oViewObj.MBLRN;
                        sKey = sMBLRN; // <-- MBLRN real
                    }

                    try {
                        // Guarda el detalle en IndexedDB (puedes guardar oPayload si prefieres)
                        await indexedDBService.saveDetailDoc(sKey, oPayload);

                        // Guarda la operación pendiente para sincronización
                        await indexedDBService.addPendingOp({
                            id: sKey,
                            type: "ScheduleLineDetail",
                            data: oPayload,
                            timestamp: Date.now(),
                            opType: opType,
                            MBLRN: sMBLRN // para facilitar la sincronización
                        });

                        sap.ui.core.BusyIndicator.hide();
                        sValidateOnBack = true;
                        MessageBox.success("Datos guardados en modo offline. Se sincronizarán automáticamente al volver online.", {
                            onClose: function () {
                                that.onCancelEdit();
                            }
                        });
                    } catch (err) {
                        sap.ui.core.BusyIndicator.hide();
                        sap.m.MessageBox.error("Error al guardar offline: " + err);
                    }
                });
                return;
            }

            // --- MODO ONLINE (lógica original, sin cambios) ---
            if (this.sModeUpdate === "c") {
                sValidateOnBack = true;
                var nsUrol = host + "/Ranges/query";
                var oResponse = this.getDataRangesSynchronously(nsUrol);
                var sMBLRN = "";
                if (oResponse) {
                    var oResult = oResponse.find(objectype => objectype.OBJECT === "RECEPALM");
                    if (Number(oResult['COUNT']) === 0) {
                        idProgAlmacen = Number(oResult['FROMNUMBER']);
                    } else {
                        idProgAlmacen = Number(oResult['COUNT']) + 1;
                    }
                    if (idProgAlmacen > Number(oResult['TONUMBER'])) {
                        MessageToast.show(oBuni18n.getResourceBundle().getText("rangeFinish"));
                        return;
                    }

                    sMBLRN = idProgAlmacen;
                }

                var oPayload = this._getPayload(sMBLRN);

                let response = await fetch(host + `/MaterialDocument`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(oPayload)
                });
                let responseData = await response.json();
                if (!response.ok) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error(responseData.error);
                    return responseData;
                }
                if (response.status === 200) {
                    sap.ui.core.BusyIndicator.hide();
                    var oSUrl = host + "/Ranges/update/RECEPALM";
                    const oSData = { COUNT: idProgAlmacen };
                    this.updateDataCountRanges(oSUrl, oSData);
                    this.updateScheduleLineQuantity();
                    this.onUploadPhotos(sMBLRN); //upload images
                    this.onDeletePhotos(); //delete
                    var smg1 = oBuni18n.getText("msUpdated");
                    smg1 = smg1 + " " + idProgAlmacen;
                    MessageBox.success(smg1, {
                        onClose: function () {
                            that.onCancelEdit();
                        }
                    });
                }

                return responseData;
            } else if (smodeId === "r" || smodeId === "c") {
                sValidateOnBack = true;
                this._update(oEvent);
            }
        },
        /*
        _update: async function (oEvent) {
            var that = this;
            var oViewObj = this.oReceptMaterialsHeader;
            var oPayload = this._getPayloadUpdate(oViewObj);
            var url = `${host}/MaterialDocument/${oViewObj.MBLRN}`;
            //try {
            let response = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oPayload)
            });
            let responseData = await response.json();
            if (!response.ok) {
                sap.ui.core.BusyIndicator.hide();
                var sMsg = "";
                if (responseData.mensaje) {
                    sMsg = responseData.mensaje;
                }
                if (responseData.error) {
                    sMsg = responseData.error;
                }
                MessageBox.error(sMsg);
                return responseData;
            }
            if (response.status === 200) {
                //upload images
                this.updateScheduleLineQuantity();
                this.onUploadPhotos(oViewObj.MBLRN);
                this.onDeletePhotos(); //delete
                sap.ui.core.BusyIndicator.hide();
                var smg1 = oBuni18n.getText("msUpdated");
                smg1 = smg1 + " " + oViewObj.MBLRN;
                MessageBox.success(smg1, {
                    onClose: function () {
                        that.onCancelEdit();
                    }
                });
            }
            return responseData;
            //} catch (error) {
            //    sap.ui.core.BusyIndicator.hide();
            //    return { error: error.message };
            //}
        },
        */
        // Offline
        _update: async function (oEvent) {
            var that = this;
            var oViewObj = this.oReceptMaterialsHeader;
            var oPayload = this._getPayloadUpdate(oViewObj);
            var url = `${host}/MaterialDocument/${oViewObj.MBLRN}`;

            // --- MANEJO OFFLINE ---
            if (!window.navigator.onLine) {
                sap.ui.require([
                    "com/xcaret/recepcionarticulosoff/model/indexedDBService"
                ], async function (indexedDBService) {
                    let sKey = oViewObj.MBLRN || "TEMP_" + Date.now();

                    try {
                        // Guarda el detalle local como respaldo
                        await indexedDBService.saveDetailDoc(sKey, oPayload);

                        // Guarda operación pendiente para sincronización (tipo update)
                        await indexedDBService.addPendingOp({
                            id: sKey,
                            type: "ScheduleLineDetail",
                            data: oPayload,
                            timestamp: Date.now(),
                            opType: "update"
                        });

                        sap.ui.core.BusyIndicator.hide();
                        MessageBox.success("Actualización guardada en modo offline. Se sincronizarán automáticamente al volver online.", {
                            onClose: function () {
                                that.onCancelEdit();
                            }
                        });
                    } catch (err) {
                        sap.ui.core.BusyIndicator.hide();
                        sap.m.MessageBox.error("Error al guardar actualización offline: " + err);
                    }
                });
                return;
            }

            // --- MODO ONLINE (original) ---
            let response = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oPayload)
            });
            let responseData = await response.json();
            if (!response.ok) {
                sap.ui.core.BusyIndicator.hide();
                var sMsg = "";
                if (responseData.mensaje) {
                    sMsg = responseData.mensaje;
                }
                if (responseData.error) {
                    sMsg = responseData.error;
                }
                MessageBox.error(sMsg);
                return responseData;
            }
            if (response.status === 200) {
                // --- LIBERACIÓN DE SESIÓN DESPUÉS DE GUARDAR ---
                try {
                    // 1. Limpiar el intervalo ANTES de liberar la sesión
                    if (this._sessionInterval) {
                        console.log("🧹 Limpiando intervalo de sesión antes de liberar");
                        clearInterval(this._sessionInterval);
                        this._sessionInterval = null;
                    }

                    // 2. Liberar la sesión con el ID original (no el nuevo generado)
                    console.log("🔍 Liberando sesión con ID original:", sObjectId);
                    const deleteResult = await Services.DeleteUserSessions();
                    if (deleteResult && deleteResult !== "Error") {
                        console.log("✅ Sesión liberada exitosamente:", sObjectId);
                    } else {
                        console.warn("⚠️ Advertencia al liberar sesión:", deleteResult);
                    }

                    // 3. Verificar que la sesión se haya liberado
                    setTimeout(async () => {
                        try {
                            const sessionCheck = await Services.GetSession(this, sObjectId);
                            if (!sessionCheck) {
                                console.log("✅ Verificación: Sesión eliminada correctamente de la base de datos");
                            } else {
                                console.warn("⚠️ Verificación: Sesión aún existe en la base de datos");
                            }
                        } catch (e) {
                            console.error("❌ Error verificando liberación de sesión:", e);
                        }
                    }, 1000); // Verificar después de 1 segundo

                } catch (e) {
                    console.error("❌ Error liberando sesión:", e);
                    // Opcional: mostrar mensaje al usuario sobre el error
                }
                // ----------- Fin limpieza sesión -----------

                //upload images
                this.updateScheduleLineQuantity();
                this.onUploadPhotos(oViewObj.MBLRN);
                this.onDeletePhotos(); //delete
                sap.ui.core.BusyIndicator.hide();
                var smg1 = oBuni18n.getText("msUpdated");
                smg1 = smg1 + " " + oViewObj.MBLRN;
                MessageBox.success(smg1, {
                    onClose: function () {
                        that.onCancelEdit();
                    }
                });
            }
            return responseData;
        },
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

        _getValidPayload: function () {
            if (aIdPSPNR === undefined || aIdPSPNR.length === 0) {
                sap.m.MessageToast.show(oBuni18n.getText("placeProject"));
                return false;
            }

            var oMultiInputResp = this.getView().byId("IdRESP");
            var aTokens = oMultiInputResp.getTokens();
            if (aTokens.length === 0) {
                sap.m.MessageToast.show(oBuni18n.getText("placeResp"));
                return false;
            }

            if (smodeId === "a") {
                const oModel = this.getView().getModel("serviceModel");
                aJsonCreate = oModel.getProperty("/ScheduleLine");
                if (aJsonCreate.Items.length === 0) {
                    sap.m.MessageToast.show(oBuni18n.getText("noItems"));
                    return false;
                }
            }

            return true;
        },

        _getValidItems: function () {
            var bReturn = true;
            var oTable = this.byId("ItemsTable");
            //2025.07.08
            var oSelectedItems = oTable.getSelectedItems();
            if (oSelectedItems.length === 0) {
                sap.m.MessageToast.show(oBuni18n.getText("noSelectedItems"));
                bReturn = false;
            } else {
                var aItems = oTable.getItems();
                for (var i = 0; i < aItems.length; i++) {
                    var oLine = aItems[i].getModel("serviceModel").getProperty(aItems[i].getBindingContextPath());
                    var iQty = parseInt(oLine?.QTY_DELIV);
                    var sStat = parseInt(oLine?.STATUS);
                    aItems[i].setHighlight("None");
                    if (iQty === 0 && sStat === 1) {
                        bReturn = false;
                        aItems[i].setHighlight("Error");
                        sap.m.MessageToast.show(oBuni18n.getText("noQtyPos", [oLine?.EBELP]));
                        break;
                    }
                }
            }
            //2025.07.08
            return bReturn;
        },

        updateScheduleLineQuantity: function () {
            var oPayload = this.getScheduleLineQuantityPayload();
            if (oPayload.length > 0) {
                const sBaseUrl = host + "/ScheduleLineQuantity";
                var xhr = new XMLHttpRequest();
                xhr.open("PUT", sBaseUrl, false);
                xhr.setRequestHeader("Content-Type", "application/json");
                xhr.send(JSON.stringify(oPayload));
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    console.log("Success (" + "/ScheduleLineQuantity" + "): ", response);
                } else {
                    xhr.statusText;
                }
            }
        },

        getScheduleLineQuantityPayload: function () {
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            var aReturn = [];
            for (var i = 0; i < aJsonCreate.Items.length; i++) {
                var oLine = aJsonCreate.Items[i];
                if (oLine.LINE_SELECTED) { //2025.07.08
                    var bAdd = true;
                    var sAddQuantity = 0;
                    if (!oLine.B_RESERVED) {
                        sAddQuantity = parseInt(oLine.QTY_DELIV_COPY);
                    } else {
                        var iReserved = parseInt(oLine.RESERVED_QTY_DELIV);
                        var iQuan = parseInt(oLine.QTY_DELIV_COPY);
                        var iRes = iReserved - iQuan;
                        if (iRes !== 0) {
                            iRes = iRes * (-1);
                            sAddQuantity = iRes;
                        } else {
                            bAdd = false;
                        }
                    }

                    if (bAdd) {
                        var oItem = {
                            "EBELN": oLine.EBELN_MAT,
                            "EBELP": oLine.EBELP_MAT,
                            "ADD_QUANTITY": sAddQuantity
                        };
                        aReturn.push(oItem);
                    }
                }
            }

            //sort by EBELP
            aReturn.sort((a, b) => a.EBELP - b.EBELP);
            return aReturn;
        },

        setHighlight: function (oItem, sStyle) {
            oItem.setHighlight(sStyle);
        },

        onAddTotal: function (items) {
            sTotalHeader = 0.00;
            if (items) {
                items.forEach(line => {

                    if (line.MENGE !== "")
                        sTotalHeader = sTotalHeader + Number(line.MENGE);
                });
            }
            let num = parseFloat(sTotalHeader).toFixed(2);
            var sVt = this.getView().byId("titleTotal");
            sVt.setText(num);
        },
        /*
        _getPayloadUpdate: function (oViewObj) {
            var that = this;
            let idResp, respName;
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            var oGlobalModel = this.getView().getModel("globalModel");
            var oMultiInputResp = this.getView().byId("IdRESP");
            var aTokens = oMultiInputResp.getTokens();
            aTokens.forEach(function (oToken) {
                idResp = oToken.getKey();
                respName = oToken.getText();
            });
            var aItems = that._getLinesTable(aJsonCreate, oViewObj.MBLRN);
            return {
                "MJAHR": oViewObj.MJAHR,
                "BLDAT": oViewObj.BLDAT,
                "BUDAT": this.getSelectedDate(),
                "SYNCRO": oViewObj.SYNCRO,
                "ERNAM": oViewObj.ERNAM,
                //"ERNAM2": "pendiente",
                "XBLNR": oViewObj.XBLNR,
                "Items": aItems
            };
        },
        */
        // Offline
        _getPayloadUpdate: function (oViewObj) {
            let idResp, respName;
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            var oGlobalModel = this.getView().getModel("globalModel");
            var oMultiInputResp = this.getView().byId("IdRESP");
            var aTokens = oMultiInputResp.getTokens();
            aTokens.forEach(function (oToken) {
                idResp = oToken.getKey();
                respName = oToken.getText();
            });
            var aItems = this._getLinesTable(aJsonCreate, oViewObj.MBLRN);
            return {
                "MJAHR": oViewObj.MJAHR || this.getCurrentYear(),
                "BLDAT": oViewObj.BLDAT || this.getCurrentDate(),
                "BUDAT": this.getSelectedDate(),
                "SYNCRO": oViewObj.SYNCRO || "1",
                "ERNAM": oViewObj.ERNAM,
                "XBLNR": oViewObj.XBLNR,
                "Items": aItems
            };
        },

        _getPayloadUpdateStatus: function (oViewObj) {
            var that = this;
            let idResp, respName;
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            var oGlobalModel = this.getView().getModel("globalModel");
            var oMultiInputResp = this.getView().byId("IdRESP");
            var aTokens = oMultiInputResp.getTokens();
            aTokens.forEach(function (oToken) {
                idResp = oToken.getKey();
                respName = oToken.getText();
            });
            var aItems = that._getLinesTableStatus(aJsonCreate, oViewObj.MBLRN);
            return {
                "MJAHR": oViewObj.MJAHR,
                "BLDAT": oViewObj.BLDAT,
                "BUDAT": this.getSelectedDate(),
                "SYNCRO": oViewObj.SYNCRO,
                "ERNAM": oViewObj.ERNAM,
                //"ERNAM2": "pendiente",
                "XBLNR": oViewObj.XBLNR,
                "Items": aItems
            };
        },



        _getObjStatus: function (aItems) {
            var sStat = 1;
            var iCont = 0;
            for (var i = 0; i < aItems.length; i++) {
                if (aItems[i].STATU === 3 || aItems[i].STATU === "3") {
                    iCont = iCont + 1;
                }
            }

            if (iCont === aItems.length) {
                sStat = 2;
            }

            return sStat;
        },
        /*
        _getPayload: function (sMBLRN) {
            var that = this;
            let idResp, respName;
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            var oGlobalModel = this.getView().getModel("globalModel");
            var oMultiInputResp = this.getView().byId("IdRESP");
            var aTokens = oMultiInputResp.getTokens();
            aTokens.forEach(function (oToken) {
                idResp = oToken.getKey();
                respName = oToken.getText();
            });

            var aItems = that._getLinesTable(aJsonCreate, sMBLRN);

            return [
                {
                    "MBLRN": parseInt(sMBLRN).toString(),
                    "MJAHR": this.getCurrentYear(),
                    "BLDAT": this.getCurrentDate(),
                    "BUDAT": this.getSelectedDate(),
                    "SYNCRO": 1,
                    "ERNAM": oJsonCreate[0].ERNAM,
                    //"ERNAM2": null, //pendiente
                    "XBLNR": oGlobalModel.getProperty("/EBELN"),
                    "items": aItems
                }
            ];
        },
        */
        // Offline
        _getPayload: function (sMBLRN) {
            let idResp, respName;
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            var oGlobalModel = this.getView().getModel("globalModel");
            var oMultiInputResp = this.getView().byId("IdRESP");
            var aTokens = oMultiInputResp.getTokens();
            aTokens.forEach(function (oToken) {
                idResp = oToken.getKey();
                respName = oToken.getText();
            });

            var aItems = this._getLinesTable(aJsonCreate, sMBLRN);

            return [{
                "MBLRN": parseInt(sMBLRN).toString(),
                "MJAHR": this.getCurrentYear(),
                "BLDAT": this.getCurrentDate(),
                "BUDAT": this.getSelectedDate(), // <-- IMPORTANTE
                "SYNCRO": "1",
                "ERNAM": aJsonCreate.ERNAM || (aJsonCreate[0] && aJsonCreate[0].ERNAM) || "",
                "XBLNR": oGlobalModel.getProperty("/EBELN"),
                "Items": aItems
            }];
        },

        getSelectedDate: function () {
            var oDatePicker = this.byId("IdEINDTDatePicker2");
            var sDate = oDatePicker.getValue(); // Esto ya devuelve la fecha como string en "YYYY-MM-DD"
            return sDate;
        },

        getCurrentDate: function () {
            var oDate = new Date();
            var day = String(oDate.getDate()).padStart(2, '0');
            var month = String(oDate.getMonth() + 1).padStart(2, '0'); // Los meses van de 0 a 11
            var year = oDate.getFullYear();
            return year + "-" + month + "-" + day;
        },

        getCurrentYear: function () {
            var oDate = new Date();
            var iYear = oDate.getFullYear();
            return iYear;
        },

        _getLinesTable: function (aJsonCreate, sMBLRN, bDisp) {
            var aReturn = [];
            var that = this;
            for (var i = 0; i < aJsonCreate.Items.length; i++) {
                var oLine = aJsonCreate.Items[i];
                if (oLine.LINE_SELECTED || oLine.B_RESERVED) { //2025.07.08
                    var oItem = that._getLineDetail(oLine, sMBLRN);
                    if (this.sModeUpdate !== "c") {
                        delete oItem.MBLRN;
                    }
                    aReturn.push(oItem);
                }
            }

            //sort by EBELP
            aReturn.sort((a, b) => a.EBELP - b.EBELP);
            return aReturn;
        },

        _getLinesTableStatus: function (aJsonCreate, sMBLRN, bDisp) {
            var aReturn = [];
            var that = this;
            for (var i = 0; i < aJsonCreate.Items.length; i++) {
                var oLine = aJsonCreate.Items[i];
                if (parseInt(oLine.STATU) !== 3) {
                    var oItem = that._getLineDetail(oLine, sMBLRN);
                    if (this.sModeUpdate !== "c") {
                        delete oItem.MBLRN;
                    }
                    aReturn.push(oItem);
                }
            }

            //sort by EBELP
            aReturn.sort((a, b) => a.EBELP - b.EBELP);
            return aReturn;
        },
        /*
        _getLineDetail: function (oLine, sMBLRN) {
            var that = this;
            var oGlobalModel = this.getView().getModel("globalModel");
            return {
                "MBLRN": sMBLRN,
                "LINE_ID": (oLine?.EBELP_MAT || ""),
                "MJAHR": this.getCurrentYear(),
                //"BWART": null, //no enviar
                "MATNR": (oLine?.MAT_MATNR || ""),
                "LIFNR": oGlobalModel.getProperty("/lifnr"),
                //"EBELN": (oLine?.EBELN_MAT || ""), //25.06.2025
                //"EBELP": (oLine?.EBELP_MAT || ""), //25.06.2025
                "PROGN": (oLine?.EBELN_MAT || ""),
                "PROGP": (oLine?.EBELP_MAT || ""),
                "ERFMG": (oLine?.QTY_DELIV_COPY || ""), //enviar cantidad ingresada en el campo 'recibido'
                "ERFME": (oLine?.MEINS || ""), //Enviar unidad de medida de acuerdo a la posicion de la programaciion
                "WAERS": (oLine?.WAERS || ""), //Enviar moneda de acuerdo a la posicion de la programaciion
                "TEXT1": (oLine?.COMMENT || ""),  //enviar el valor que tenga el campo 'comentarios'
                "SYNCRO": "1", // enviar valor '1'
                "BLDAT": this.getCurrentDate(), //enviar fecha actual -> solo cuando se crea 
                //"SIDAT": (oLine?.SIDAT || ""),  //no enviar
                "BUDAT": this.getSelectedDate(),  //agregar campo de fecha a nivel encabezado, por default traer fecha del dia, etiqueta: Fecha de contabilizacion: editable, hasta que se contabilice
                "ERNAM": (oLine?.ERNAM || ""),  //presentar ventana al inicar la app donde mostremos usuarios que acttualmente se tienen en el filtro de 'creado por' : quitar filtro de pantalla inical y ponerlo como boton con label 'cambiar usuario'
                "MODIF": (oLine?.MODIF || "")   //modificado por : tomar el valor del usario activo
            };
        },
        */
        // Offline
        _getLineDetail: function (oLine, sMBLRN) {
            var oGlobalModel = this.getView().getModel("globalModel");
            return {
                "MBLRN": sMBLRN,
                "LINE_ID": oLine?.EBELP || oLine?.LINE_ID || "",
                "MJAHR": this.getCurrentYear(),
                "MATNR": oLine?.MAT_MATNR || oLine?.MATNR || "",
                "LIFNR": oGlobalModel.getProperty("/lifnr"),
                "PROGN": oGlobalModel.getProperty("/EBELN") || sMBLRN,
                "PROGP": oLine?.EBELP || oLine?.LINE_ID || "",
                "ERFMG": oLine?.QTY_DELIV_COPY || oLine?.ERFMG || "",
                "ERFME": oLine?.MEINS || oLine?.ERFME || "",
                "WAERS": oLine?.WAERS || "",
                "TEXT1": oLine?.COMMENT || oLine?.TEXT1 || "",
                "SYNCRO": "1",
                "BLDAT": this.getCurrentDate(),
                "BUDAT": this.getSelectedDate(),
                "ERNAM": oLine?.ERNAM || "",
                "MODIF": oLine?.MODIF || ""
            };
        },

        _updateMENGE_C: function (aItems) {
            this.aContrData = [];
            this.aSpecData = [];

            aItems.forEach(line => {

                var sMengeC = line.WEMNG;
                line.MENGE_C = line.MENGE_C ? line.MENGE_C : 0;
                if (smodeId === "a") {
                    sMengeC = parseInt(line.MENGE_C) + parseFloat(line.WEMNG);
                } else {
                    var iReserved = line.RESERVED_MENGE ? line.RESERVED_MENGE : 0;
                    var iQty = parseFloat(line.WEMNG) - parseFloat(iReserved);
                    sMengeC = parseInt(line.MENGE_C) + iQty;
                }
                sMengeC = this._getFormatValueQuantity(sMengeC);

                var iMenge = parseFloat(line.MENGE);
                var iMenge_C = parseFloat(sMengeC);
                var iStat = 0;

                if (line.CONTR && line.CONPS) {

                    var oContrItem = {
                        ID_CON: line.ID_CON,
                        CONPO: line.CONPO,
                        EBELN: line.CONTR,
                        EBEL: line.CONPS,
                        MENGE_C: sMengeC
                    };

                    if (iMenge_C === 0) {
                        iStat = 1; //Activo
                    }

                    if (iMenge_C === iMenge) {
                        iStat = 3; // Concluido
                    }

                    if (iMenge_C < iMenge) {
                        if (iMenge_C !== 0) {
                            iStat = 2; //Tratado parcial
                        }
                    }

                    if (iStat > 0) {
                        oContrItem["ESTAT"] = iStat.toString();
                    }

                    this.aContrData.push(oContrItem);

                    //update MENGE_C
                    line.MENGE_C = sMengeC;

                } else {

                    var oSpecItem = {
                        BANFN: line.BANFN,
                        BNFPO: line.BNFPO,
                        MENGE_C: sMengeC
                    };

                    if (iMenge_C === 0) {
                        iStat = 1; //Activo
                    }

                    if (iMenge_C === iMenge) {
                        iStat = 4; // Concluido
                    }

                    if (iMenge_C < iMenge) {
                        if (iMenge_C !== 0) {
                            iStat = 3; //Tratado parcial
                        }
                    }

                    if (iStat > 0) {
                        oSpecItem["STATUS"] = iStat.toString();
                    }
                    this.aSpecData.push(oSpecItem);

                    //update MENGE_C
                    line.MENGE_C = sMengeC;
                }
            });

            return aItems;
        },
        // Meétodo que se utilizaba con cordova
        /*
        onUploadPhotos: function (sMBLRN) {
            const that = this;

            if (!this._aImageSource || !this._aImageSource.length) {
                //sap.m.MessageToast.show("No hay imágenes para subir");
                return;
            }

            // 🔎 Filtrar solo imágenes nuevas (ind === 'n')
            const aNewImages = this._aImageSource.filter(img => img.ind === 'n');

            if (!aNewImages.length) {
                //sap.m.MessageToast.show("No hay imágenes nuevas para subir");
                return;
            }

            const formData = new FormData();
            const metadataArray = [];
            let pending = aNewImages.length;

            aNewImages.forEach(function (imgData, index) {
                imgData.fileEntry.file(function (realFile) {
                    const reader = new FileReader();

                    reader.onloadend = function () {
                        const blob = new Blob([new Uint8Array(this.result)], { type: realFile.type });

                        formData.append("image", blob, realFile.name);

                        metadataArray.push({
                            MBLRN: sMBLRN,
                            LINE_ID: imgData.pos,
                            INDEX: imgData.index,
                            IMAGE_NAME: realFile.name || ("CAPTURA" + (index + 1))
                        });

                        pending--;

                        if (pending === 0) {
                            formData.append("metadata", JSON.stringify(metadataArray));

                            $.ajax({
                                url: host + "/ImageMaterialReceptionItem",
                                type: "POST",
                                data: formData,
                                async: false,
                                processData: false,
                                contentType: false,
                                success: function (response) {
                                    console.log("Fotos subidas correctamente");
                                    console.log("Respuesta del servidor:", response);

                                    // ✅ Marcar como ya subidas las imágenes nuevas
                                    aNewImages.forEach(img => img.ind = 'e');

                                },
                                error: function (xhr, status, error) {
                                    console.error("Error al subir fotos:", status, error);
                                    //sap.m.MessageToast.show("Error al subir imágenes");
                                }
                            });
                        }
                    };

                    reader.readAsArrayBuffer(realFile);
                }, function (error) {
                    console.error("Error al leer archivo:", error);
                    pending--;
                });
            });
        },
        */
        // Se adapta para fileUploader y cámara
        onUploadPhotos: function (sMBLRN) {
            const that = this;

            if (!this._aImageSource || !this._aImageSource.length) {
                return;
            }

            // 🔎 Filtrar solo imágenes nuevas (ind === 'n')
            const aNewImages = this._aImageSource.filter(img => img.ind === 'n');
            if (!aNewImages.length) {
                return;
            }

            const formData = new FormData();
            const metadataArray = [];
            let pending = aNewImages.length;

            aNewImages.forEach(function (imgData, index) {
                // Si es Cordova, usa fileEntry
                if (imgData.fileEntry) {
                    imgData.fileEntry.file(function (realFile) {
                        const reader = new FileReader();
                        reader.onloadend = function () {
                            const blob = new Blob([new Uint8Array(this.result)], { type: realFile.type });
                            formData.append("image", blob, realFile.name);
                            metadataArray.push({
                                MBLRN: sMBLRN,
                                LINE_ID: imgData.pos,
                                INDEX: imgData.index,
                                IMAGE_NAME: realFile.name || ("CAPTURA" + (index + 1))
                            });
                            pending--;
                            if (pending === 0) {
                                formData.append("metadata", JSON.stringify(metadataArray));
                                that._sendPhotoFormData(formData, aNewImages);
                            }
                        };
                        reader.readAsArrayBuffer(realFile);
                    }, function (error) {
                        console.error("Error al leer archivo:", error);
                        pending--;
                    });
                    // Si es FileUploader estándar
                } else if (imgData.file) {
                    const reader = new FileReader();
                    reader.onloadend = function () {
                        const blob = new Blob([new Uint8Array(this.result)], { type: imgData.file.type });
                        formData.append("image", blob, imgData.file.name);
                        metadataArray.push({
                            MBLRN: sMBLRN,
                            LINE_ID: imgData.pos,
                            INDEX: imgData.index,
                            IMAGE_NAME: imgData.file.name || ("CAPTURA" + (index + 1))
                        });
                        pending--;
                        if (pending === 0) {
                            formData.append("metadata", JSON.stringify(metadataArray));
                            that._sendPhotoFormData(formData, aNewImages);
                        }
                    };
                    reader.readAsArrayBuffer(imgData.file);
                } else if (imgData.file) { // Esta rama se ejecutará para las fotos capturadas por la cámara
                    const reader = new FileReader();
                    reader.onloadend = function () {
                        const blob = new Blob([new Uint8Array(this.result)], { type: imgData.file.type });
                        formData.append("image", blob, imgData.file.name); // Esto funcionará perfectamente
                        metadataArray.push({
                            MBLRN: sMBLRN,
                            LINE_ID: imgData.pos,
                            INDEX: imgData.index,
                            IMAGE_NAME: imgData.file.name || ("CAPTURA" + (index + 1))
                        });
                        pending--;
                        if (pending === 0) {
                            formData.append("metadata", JSON.stringify(metadataArray));
                            that._sendPhotoFormData(formData, aNewImages);
                        }
                    };
                    reader.readAsArrayBuffer(imgData.file); // Lee el Blob/File como ArrayBuffer
                }
            });
        },

        _sendPhotoFormData: function (formData, aNewImages) {
            console.log(formData)
            console.log(aNewImages)
            $.ajax({
                url: host + "/ImageMaterialReceptionItem",
                type: "POST",
                data: formData,
                async: false,
                processData: false,
                contentType: false,
                success: function (response) {
                    console.log("Fotos subidas correctamente");
                    aNewImages.forEach(img => img.ind = 'e');
                },
                error: function (xhr, status, error) {
                    console.error("Error al subir fotos:", status, error);
                }
            });
        },

        onDeletePhotos: function () {
            var aDeleteData = this._aDeleteImageSource;

            if (!aDeleteData || aDeleteData.length === 0) {
                //MessageToast.show("No hay imágenes marcadas para borrar.");
                return;
            }

            $.ajax({
                url: host + "/ImageMaterialReceptionItem",
                method: "DELETE",
                contentType: "application/json",
                data: JSON.stringify(aDeleteData),
                success: function (response) {
                    console.log("Imágenes eliminadas correctamente.");
                    this._aDeleteImageSource = [];
                }.bind(this),
                error: function (xhr, status, error) {
                    console.log("Error al eliminar imágenes: " + xhr.responseText);
                }
            });
        },

        onDeletePic: function (oEvent) {
            var that = this;
            var sFragmentId = this.createId("myDialog");
            var oDialog = sap.ui.core.Fragment.byId(sFragmentId, "myDialog");
            var sTitle = oDialog.getTitle();
            var sTitlePos = oBuni18n.getText("titlePos") + " ";
            var sPosition = sTitle.split(sTitlePos)[1];
            var oActivePage = oEvent.getSource().getParent().getContent()[0].getActivePage();
            var oLineSelected = sap.ui.getCore().byId(oActivePage).getBindingContext().getObject();
            if (oLineSelected.ind === "e") {
                var oDelItem = {
                    "MBLRN": this.sObjMBLRN,
                    "LINE_ID": oLineSelected.pos,
                    "INDEX": oLineSelected.index
                }
                this._aDeleteImageSource.push(oDelItem);
            }

            //remuevo item de array general
            this._aImageSource = this._aImageSource.filter(oItem => oItem !== oLineSelected);
            var aData = this._aImageSource.filter(oItem => oItem.pos === sPosition);
            var oModel = new sap.ui.model.json.JSONModel(aData);
            sap.ui.getCore().byId(oActivePage).setModel(oModel)
            oModel.refresh();
        },

        _postMENGE_C: function () {
            if (this.aContrData.length > 0) {
                this._updateAPIData(this.aContrData, "/ContractItems/");
            }

            if (this.aSpecData.length > 0) {
                this._updateAPIData(this.aSpecData, "/Requirement/");
            }

            this.aContrData = [];
            this.aSpecData = [];
        },

        //Acutalizo Requirement 'Special' and 'ContractItems'
        _updateAPIData: function (oPayload, sPath) {
            const sBaseUrl = host + sPath;
            var xhr = new XMLHttpRequest();
            xhr.open("PUT", sBaseUrl, false);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(JSON.stringify(oPayload));
            if (xhr.status === 200) {
                var response = JSON.parse(xhr.responseText);
                console.log("Success (" + sPath + "): ", response);
                return "";
            } else {
                xhr.statusText;
                return xhr.responseText;
            }
        },

        onEditTexts: function (aFieldIds, bEditMode) {
            aFieldIds.forEach(function (sFieldId) {
                var oControl = this.byId(sFieldId);
                if (oControl) {
                    oControl.setVisible(bEditMode);

                } else {
                    console.warn("Control with ID " + sFieldId + " not found.");
                }
            }.bind(this));
        },

        onChangeXdificaAll: function (oEvent) {
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            if (aJsonCreate === undefined || aJsonCreate.Items.length === 0) {
                oEvent.getSource().setState(!oEvent.getParameter("state"));
                sap.m.MessageToast.show(oBuni18n.getText("noItems"));
            } else {
                for (var i = 0; i < aJsonCreate.Items.length; i++) {
                    aJsonCreate.Items[i].RECEP_XDIFICA = oEvent.getParameter("state");
                }
                oModel.refresh();
            }
        },

        onSelectionChange: function (oEvent) {
            const oTable = this.byId("ItemsTable");
            const bSelectAll = oEvent.getParameter("selectAll");
            const oModel = this.getView().getModel("serviceModel");
            let selectedCount = 0;
            let blockedCount = 0;

            if (bSelectAll) {
                oTable.removeSelections(true); // Limpia selecciones previas

                oTable.getItems().forEach(function (oListItem) {
                    const sPath = oListItem.getBindingContext("serviceModel").getPath();
                    const item = oModel.getProperty(sPath);
                    if (parseInt(item.STATU) !== 3) {
                        oTable.setSelectedItem(oListItem, true);
                        selectedCount++;
                    } else {
                        oTable.setSelectedItem(oListItem, false);
                        blockedCount++;
                    }
                });

                // Mensaje personalizado
                if (selectedCount > 0) {
                    sap.m.MessageToast.show(
                        `Se seleccionaron ${selectedCount} elementos.`
                        + (blockedCount > 0 ? ` (${blockedCount} elementos no pueden seleccionarse por su estatus)` : "")
                    );
                } else {
                    sap.m.MessageToast.show("Ningún elemento puede seleccionarse debido a su estatus.");
                }
            } else {
                // Selección individual
                const aSelectedItems = oTable.getSelectedItems();
                let manualBlocked = 0;
                aSelectedItems.forEach((oListItem) => {
                    const sPath = oListItem.getBindingContext("serviceModel").getPath();
                    const item = oModel.getProperty(sPath);
                    if (parseInt(item.STATU) === 3) {
                        oListItem.setSelected(false);
                        manualBlocked++;
                    }
                });

                if (manualBlocked > 0) {
                    sap.m.MessageToast.show(
                        `${manualBlocked} elemento${manualBlocked > 1 ? 's' : ''} no pueden seleccionarse por su estatus.`
                    );
                }
            }
        },

        onCancelEdit: async function (oEvent) {
            // --- LIBERACIÓN DE SESIÓN AL CANCELAR ---
            if (window.navigator.onLine && sObjectId && sObjectId !== "New") {
                try {
                    // 1. Limpiar el intervalo ANTES de liberar la sesión
                    if (this._sessionInterval) {
                        console.log("🧹 Limpiando intervalo de sesión antes de liberar");
                        clearInterval(this._sessionInterval);
                        this._sessionInterval = null;
                    }

                    // 2. Liberar la sesión con el ID original de la sesión
                    console.log("🔍 Liberando sesión con ID original:", sObjectId);
                    const deleteResult = await Services.DeleteUserSessions();
                    if (deleteResult && deleteResult !== "Error") {
                        console.log("✅ Sesión liberada exitosamente:", sObjectId);
                    } else {
                        console.warn("⚠️ Advertencia al liberar sesión:", deleteResult);
                    }

                    // 3. Verificar que la sesión se haya liberado
                    setTimeout(async () => {
                        try {
                            const sessionCheck = await Services.GetSession(this, sObjectId);
                            if (!sessionCheck) {
                                console.log("✅ Verificación: Sesión eliminada correctamente de la base de datos");
                            } else {
                                console.warn("⚠️ Verificación: Sesión aún existe en la base de datos");
                            }
                        } catch (e) {
                            console.error("❌ Error verificando liberación de sesión:", e);
                        }
                    }, 1000); // Verificar después de 1 segundo

                } catch (e) {
                    console.error("❌ Error liberando sesión:", e);
                    // Opcional: mostrar mensaje al usuario sobre el error
                }
                // --- Fin liberación sesión ---
            }

            // Limpiar campos de AddToTable.fragment.xml usando el ID correcto ('myDialog')
            try {
                var sFragmentId = this.createId("myDialog");
                var oFileUploader = sap.ui.core.Fragment.byId(sFragmentId, "idFileUploader");
                var oPhotoPreview = sap.ui.core.Fragment.byId(sFragmentId, "idPhotoPreview");
                if (oFileUploader && typeof oFileUploader.clear === "function") {
                    oFileUploader.clear();
                }
                if (oPhotoPreview && typeof oPhotoPreview.setSrc === "function") {
                    oPhotoPreview.setSrc("");
                }
            } catch (e) {
                // Si el fragmento no está cargado, no hacer nada
            }
            let localStatus = oEditstatus;
            this.onEnableFollow(false);
            this._setEditEnabledLabels(false);

            const oModel = this.getView().getModel("serviceModel");
            var aGeneralData = oModel.getProperty("/ScheduleLine/Items");
            if (aGeneralData === undefined) {
                aGeneralData = [];
            }

            if ((smodeId === "r") && sValidateOnBack === true) {
                this.onNavBack();
            } else if ((smodeId === "c" || smodeId === "a") && aGeneralData.length !== 0 && (sValidateOnBack === false)) {
                this.showSaveDialogBeforeBack();
            } else if ((smodeId === "r") && localStatus === true) {
                this.showSaveDialogBeforeBack();
            } else {
                this.onNavBack();
            }

        },
        updateDataCountRanges: async function (url, data) {
            try {
                const response = await fetch(url, {
                    method: 'PUT', // HTTP method
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data) // Convert data to JSON string
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const result = await response.json();
                return result;
            } catch (error) {
                console.error('Error updating data Project ranges :', error);
            }
        },

        onNavBack: async function () {
            console.log("Se ejecuta onnavback")
            // --- LIBERACIÓN DE SESIÓN AL NAVEGAR ---
            if (window.navigator.onLine && sObjectId && sObjectId !== "New") {
                try {
                    // Limpia el intervalo de sesión si existe
                    if (this._sessionInterval) {
                        console.log("🧹 Limpiando intervalo de sesión antes de liberar");
                        clearInterval(this._sessionInterval);
                        this._sessionInterval = null;
                    }

                    // Libera el lock de sesión utilizando el ID original de la sesión
                    console.log("🔍 Liberando sesión con ID original:", sObjectId);
                    const deleteResult = await Services.DeleteUserSessions();
                    if (deleteResult && deleteResult !== "Error") {
                        console.log("✅ Sesión liberada exitosamente:", sObjectId);
                    } else {
                        console.warn("⚠️ Advertencia al liberar sesión:", deleteResult);
                    }

                    // Verificar que la sesión se haya liberado
                    setTimeout(async () => {
                        try {
                            const sessionCheck = await Services.GetSession(this, sObjectId);
                            if (!sessionCheck) {
                                console.log("✅ Verificación: Sesión eliminada correctamente de la base de datos");
                            } else {
                                console.warn("⚠️ Verificación: Sesión aún existe en la base de datos");
                            }
                        } catch (e) {
                            console.error("❌ Error verificando liberación de sesión:", e);
                        }
                    }, 1000); // Verificar después de 1 segundo
                } catch (e) {
                    console.error("❌ Error liberando sesión:", e);
                    // Opcional: mostrar mensaje al usuario sobre el error
                }
            }

            BusyIndicator.show(0);
            var oEventBus = sap.ui.getCore().getEventBus();
            oEventBus.publish("MainChannel", "onInitialMainPage");
            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Main", {}, true);
            history.go(-1);
        },
        /*
        openValueHelpDialog: function (sFragmentName, oEvent, sDialogId) {
            Fragment.load({
                id: this.createId(sDialogId),
                name: sFragmentName,
                controller: this
            }).then(function (oFragment) {
                this.oMultiEditDialog = oFragment;
                this.getView().addDependent(this.oMultiEditDialog);
                ////////
                var sFragmentId = this.createId(sDialogId);
                if (sDialogId === "myDialog") {
                    //var oLastUserModify = sap.ui.core.Fragment.byId(sFragmentId, "idMODIFAdd");

                    switch (smodeId) {
                        case "r"://Read
                            break;
                        case "c"://Copy
                            break;
                        case "a"://Add
                            //oLastUserModify.setValue(sUserName);
                            break;
                        default:
                            break;
                    }

                    if (oFlagPos === true) {
                        this.onObtainPositions();
                        oSearchQuotationPos = iIndex;
                        let line = oJsonCreate.Items[iIndex];
                        this.onSetValuePosition(line);
                        oFlagPos = false;
                    }
                    if (oSearchQuotationPos === undefined && oActualQuotationPos === undefined) {
                        oSearchQuotationPos = oActualQuotationPos = 0;
                    }
                }
                this.oMultiEditDialog.setEscapeHandler(function () {
                    this.onCloseDialog();
                }.bind(this));

                sap.ui.core.BusyIndicator.hide();
                this.oMultiEditDialog.open();
            }.bind(this));
        },
        */
        // Offline
        /*
        openValueHelpDialog: function (sFragmentName, oEvent, sDialogId) {
            // Si el fragmento ya está precargado, úsalo
            if (this._fragments && this._fragments[sDialogId]) {
                this.oMultiEditDialog = this._fragments[sDialogId];

                // Mantén tu lógica especial para 'myDialog'
                var sFragmentId = this.createId(sDialogId);
                if (sDialogId === "myDialog") {
                    switch (smodeId) {
                        case "r"://Read
                            break;
                        case "c"://Copy
                            break;
                        case "a"://Add
                            //oLastUserModify.setValue(sUserName);
                            break;
                        default:
                            break;
                    }
                    if (oFlagPos === true) {
                        this.onObtainPositions();
                        oSearchQuotationPos = iIndex;
                        let line = oJsonCreate.Items[iIndex];
                        this.onSetValuePosition(line);
                        oFlagPos = false;
                    }
                    if (oSearchQuotationPos === undefined && oActualQuotationPos === undefined) {
                        oSearchQuotationPos = oActualQuotationPos = 0;
                    }
                }
                this.oMultiEditDialog.setEscapeHandler(function () {
                    this.onCloseDialog();
                }.bind(this));

                sap.ui.core.BusyIndicator.hide();
                this.oMultiEditDialog.open();
                return;
            }

            // Si no está precargado (fallback), usa la lógica original
            Fragment.load({
                id: this.createId(sDialogId),
                name: sFragmentName,
                controller: this
            }).then(function (oFragment) {
                this.oMultiEditDialog = oFragment;
                this.getView().addDependent(this.oMultiEditDialog);
                var sFragmentId = this.createId(sDialogId);
                if (sDialogId === "myDialog") {
                    switch (smodeId) {
                        case "r"://Read
                            break;
                        case "c"://Copy
                            break;
                        case "a"://Add
                            //oLastUserModify.setValue(sUserName);
                            break;
                        default:
                            break;
                    }
                    if (oFlagPos === true) {
                        this.onObtainPositions();
                        oSearchQuotationPos = iIndex;
                        let line = oJsonCreate.Items[iIndex];
                        console.log(line)
                        this.onSetValuePosition(line);
                        oFlagPos = false;
                    }
                    if (oSearchQuotationPos === undefined && oActualQuotationPos === undefined) {
                        oSearchQuotationPos = oActualQuotationPos = 0;
                    }
                }
                this.oMultiEditDialog.setEscapeHandler(function () {
                    this.onCloseDialog();
                }.bind(this));

                sap.ui.core.BusyIndicator.hide();
                this.oMultiEditDialog.open();
            }.bind(this));
        },
        */

        openValueHelpDialog: function (sFragmentName, oEvent, sDialogId) {
            // SIEMPRE toma los datos actuales del modelo antes de abrir el fragmento
            const oModel = this.getView().getModel("serviceModel");
            oJsonCreate = oModel.getProperty("/ScheduleLine"); // objeto actualizado

            if (this._fragments && this._fragments[sDialogId]) {
                this.oMultiEditDialog = this._fragments[sDialogId];

                var sFragmentId = this.createId(sDialogId);
                if (sDialogId === "myDialog") {
                    switch (smodeId) {
                        case "r"://Read
                            break;
                        case "c"://Copy
                            break;
                        case "a"://Add
                            //oLastUserModify.setValue(sUserName);
                            break;
                        default:
                            break;
                    }

                    // Actualiza el detalle con el item seleccionado
                    if (oFlagPos === true) {
                        this.onObtainPositions();
                        oSearchQuotationPos = iIndex;
                        // Usa SIEMPRE el objeto actual del modelo
                        let line = oJsonCreate?.Items?.[iIndex];
                        this.onSetValuePosition(line);
                        oFlagPos = false;
                    }
                    if (oSearchQuotationPos === undefined && oActualQuotationPos === undefined) {
                        oSearchQuotationPos = oActualQuotationPos = 0;
                    }
                }
                this.oMultiEditDialog.setEscapeHandler(function () {
                    this.onCloseDialog();
                }.bind(this));

                sap.ui.core.BusyIndicator.hide();
                this.oMultiEditDialog.open();
                return;
            }

            // Fallback original (solo si no se precargó el fragmento)
            Fragment.load({
                id: this.createId(sDialogId),
                name: sFragmentName,
                controller: this
            }).then(function (oFragment) {
                this.oMultiEditDialog = oFragment;
                this.getView().addDependent(this.oMultiEditDialog);
                var sFragmentId = this.createId(sDialogId);
                if (sDialogId === "myDialog") {
                    switch (smodeId) {
                        case "r"://Read
                            break;
                        case "c"://Copy
                            break;
                        case "a"://Add
                            //oLastUserModify.setValue(sUserName);
                            break;
                        default:
                            break;
                    }
                    if (oFlagPos === true) {
                        this.onObtainPositions();
                        oSearchQuotationPos = iIndex;
                        let line = oJsonCreate?.Items?.[iIndex];
                        this.onSetValuePosition(line);
                        oFlagPos = false;
                    }
                    if (oSearchQuotationPos === undefined && oActualQuotationPos === undefined) {
                        oSearchQuotationPos = oActualQuotationPos = 0;
                    }
                }
                this.oMultiEditDialog.setEscapeHandler(function () {
                    this.onCloseDialog();
                }.bind(this));

                sap.ui.core.BusyIndicator.hide();
                this.oMultiEditDialog.open();
            }.bind(this));
        },



        /*
        onCloseDialogFragment: function (oEvent) {
            this.oMultiEditDialog.close();
            this.oMultiEditDialog.destroy();
            this.oMultiEditDialog = null;

            const oModel = this.getView().getModel("serviceModel");
            const aGeneralData = oModel.getProperty("/ScheduleLine");
            //this.onAddTotal(aGeneralData.items);
        },
        */
        // Offline
        onCloseDialogFragment: function (oEvent) {
            if (this.oMultiEditDialog) {
                this.oMultiEditDialog.close();
                // Si el fragmento fue precargado, NO lo destruyas
                if (this._fragments && Object.values(this._fragments).includes(this.oMultiEditDialog)) {
                    // Solo lo cierras, no lo destruyes
                } else {
                    // Si fue cargado dinámicamente, destrúyelo
                    this.oMultiEditDialog.destroy();
                }
                this.oMultiEditDialog = null;
            }

            const oModel = this.getView().getModel("serviceModel");
            const aGeneralData = oModel.getProperty("/ScheduleLine");
            //this.onAddTotal(aGeneralData.items);
        },
        getCurrentUserName: function (oEvent) {
            if (sap.ushell && sap.ushell.Container) {
                const oUser = sap.ushell.Container.getUser();
                sUserName = oUser.getId();
                sFName = oUser.getFirstName();
                sLName = oUser.getLastName();
                sEmail = oUser.getEmail();

                oURLApp = oURLApp + "'" + sUserName + "'";
                oURLRol = oURLRol + "'" + sEmail + "'";
            } else {
                //only test -- jc -- borrar al deployar

                /*
                sUserName = '53d6512a-591a-4961-a37f-0c670af2cb00';
                sFName = 'Eric Alejandro';
                sLName = 'Medina';
                sEmail = 'eric.medina@celeritech.biz';
    
                oURLApp = oURLApp + "'" + sUserName + "'";
                oURLRol = oURLRol + "'" + sEmail + "'";
                */

                //only test -- jc -- borrar al deployar

            }
        },

        onDialogSaveButton: function (oEvent) {
            //get values from table
            var oTable = this.byId("ItemsTable");
            var oBinding = oTable.getBinding("items");
            var oModel1 = oBinding.getModel();
            var sPath = oBinding.getPath();
            var aData = oModel1.getProperty(sPath);
            if (Array.isArray(aData)) {
                oItemsArray = aData;
            }
            ///////////////////////////////////////////////////////
            let oItemsArraylength = oItemsArray.length;
            oItemsArraylength = (oItemsArraylength + 1) * 10;
            let oItemsConPO = oItemsArraylength * 10;

            var sFragmentId = this.createId("myDialog");
            var oInputMatnr = sap.ui.core.Fragment.byId(sFragmentId, "idMatnrInputAdd");
            var oInputCONAdd = sap.ui.core.Fragment.byId(sFragmentId, "idIDCONAdd");
            var oInputMEINSAdd = sap.ui.core.Fragment.byId(sFragmentId, "idInputMeins");
            var oInputBANFNAdd = sap.ui.core.Fragment.byId(sFragmentId, "idBANFNAdd");
            var oInputCONAMNAdd = sap.ui.core.Fragment.byId(sFragmentId, "idCONAMAdd");
            var oInputKTMNGAdd = sap.ui.core.Fragment.byId(sFragmentId, "idKTMNGAdd");
            var oInputMENGEAdd = sap.ui.core.Fragment.byId(sFragmentId, "idMENGEAdd");
            var oInputNETPRAdd = sap.ui.core.Fragment.byId(sFragmentId, "idNETPRAdd");
            var oInputTOTALAdd = sap.ui.core.Fragment.byId(sFragmentId, "idTOTALAdd");
            var oInputTXZ01Add = sap.ui.core.Fragment.byId(sFragmentId, "idInputTXZ01Add");
            var oInputTXZ02Add = sap.ui.core.Fragment.byId(sFragmentId, "idInputTXZ02Add");
            var oInputEINDTAdd = sap.ui.core.Fragment.byId(sFragmentId, "IdEINDTDatePicker");

            const oNewRow = {
                BANFN: oInputBANFNAdd.getValue(),
                BNFPO: oItemsArraylength,
                CONAM: oInputCONAMNAdd.getValue(),
                CONPO: oItemsConPO,
                EBEL: oItemsArraylength,
                EBELN: "",
                EBELN1: "",
                EINDT: oInputEINDTAdd.getValue(),
                ERDAT: currentDate.toISOString().split("T")[0],
                KTMNG: oInputKTMNGAdd.getValue(),
                //LOEKZ: oSwitchState,
                ID_CON: oInputCONAdd.getValue(),
                MATNR: oInputMatnr.getValue(),
                MEINS: oInputMEINSAdd.getValue(),
                MENGE: oInputMENGEAdd.getValue(),
                MODAT: currentDate.toISOString().split("T")[0],
                NETPR: oInputNETPRAdd.getValue(),
                TOTAL: oInputTOTALAdd.getValue(),
                TXZ01: oInputTXZ01Add.getValue(),
                TXZ02: oInputTXZ02Add.getValue(),
                ERNAM: sUserName
            };
            oItemsArray.push(oNewRow);
            const oModel = this.getView().getModel("serviceModel");
            oModel.setProperty("/generalDataDetail/Items", oItemsArray);
            oActualQuotationPos += 1;
            this.onNextPosition();
            //this.onCloseDialog();
        },

        getDataRangesSynchronously: function (sUrl) {
            let oData = null;
            const xhr = new XMLHttpRequest();
            xhr.open("GET", sUrl, false);
            try {
                xhr.send();
                if (xhr.status === 200) {
                    // Parse the response as JSON
                    oData = JSON.parse(xhr.responseText);
                } else {
                    console.error(`Error: ${xhr.status} - ${xhr.statusText}`);
                }
            } catch (error) {
                console.error("Synchronous Ranges request failed:", error);
            }
            return oData; // Return the fetched data
        },

        onRowSelectionChange: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("listItem");
            var oMultiInput = this.getView().byId("IdLIFNRNameInput");
            if (oSelectedItem) {
                const oBindingContext = oSelectedItem.getBindingContext("detailModel");
                const oSelectedData = oBindingContext.getObject();
                oMultiInput.removeAllTokens();
                var oToken = new sap.m.Token({
                    key: oSelectedData.LIFNR,
                    text: oSelectedData.NAME1
                });
                oMultiInput.addToken(oToken);
                const oInputLifnr = this.byId("IdLIFNRInput");
                oInputLifnr.setValue(oSelectedData.LIFNR);
                this.onCloseDialog();
            } else {

            }
        },

        onRowSelectionChangeProject: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("listItem");
            var oMultiInput = this.getView().byId("IdNAMEPInput");
            if (oSelectedItem) {
                const oBindingContext = oSelectedItem.getBindingContext("detailModel");
                const oSelectedData = oBindingContext.getObject();
                oMultiInput.removeAllTokens();
                var oToken = new sap.m.Token({
                    key: oSelectedData.ID_PEP,
                    text: oSelectedData.NAME1
                });
                oMultiInput.addToken(oToken);
                const oInputIdProject = this.byId("IdPSPNRInput");
                oInputIdProject.setValue(oSelectedData.ID_PEP);
                let oModel = this.getView().getModel("detailModel");
                oModel.setProperty("/generalDataDetail/PSPNR", oSelectedData.ID_PEP);
                oModel.setProperty("/generalDataDetail/NAMEP", oSelectedData.NAME1);
                this.onCloseDialog();

            } else {

            }
        },

        onCloseChangeRef: function () {
            this.onChangeRow();
            this.onCloseDialogFragment();
            var oGlobalModel = this.getView().getModel("globalModel");
            var oGlobalModel1 = this.getView().getModel("globalModelNoEditables");
            if (oEditstatus === true) {
                oGlobalModel.setProperty("/enabled", true);
                oGlobalModel1.setProperty("/enableds", true);
            }

        },

        _setEnabledEditPos: function (bBand) {
            var oGlobalModel = this.getView().getModel("globalModelNoEditables");
            oGlobalModel.setProperty("/enableds", bBand);
        },

        onObtainPositions: function () {
            let oItemsPos = [];
            var oTable = this.byId("ItemsTable");
            var oBinding = oTable.getBinding("items");
            var oModel1 = oBinding.getModel();
            var sPath = oBinding.getPath();
            var aData = oModel1.getProperty(sPath);
            if (Array.isArray(aData)) {
                oItemsPos = aData;
            }
            if (oItemsPos.length > 0) {
                oActualQuotationPos = oSearchQuotationPos = oItemsPos.length - 1;
            }
        },

        onPreviuesPosition: function (oEvent) {
            // Limpiar campos de AddToTable.fragment.xml (myDialog)
            try {
                var sFragmentId = this.createId("myDialog");
                var oFileUploader = sap.ui.core.Fragment.byId(sFragmentId, "idFileUploader");
                var oPhotoPreview = sap.ui.core.Fragment.byId(sFragmentId, "idPhotoPreview");
                if (oFileUploader && typeof oFileUploader.clear === "function") {
                    oFileUploader.clear();
                }
                if (oPhotoPreview && typeof oPhotoPreview.setSrc === "function") {
                    oPhotoPreview.setSrc("");
                }
            } catch (e) {
                // Si el fragmento no está cargado, no hacer nada
            }
            this.onChangeRow();
            //get values from table
            const oModel = this.getView().getModel("serviceModel");
            var aGeneralPos = oModel.getProperty("/ScheduleLine/Items");

            if ((typeof oSearchQuotationPos !== "undefined" || oSearchQuotationPos !== "") && oSearchQuotationPos !== 0) {
                oSearchQuotationPos -= 1
                this.onSetValuePosition(aGeneralPos[oSearchQuotationPos]);
            } else if (oSearchQuotationPos === 0) {
                this.onSetValuePosition(aGeneralPos[0]);
            }
        },

        onNextPosition: function () {
            // Limpiar campos de AddToTable.fragment.xml (myDialog)
            try {
                var sFragmentId = this.createId("myDialog");
                var oFileUploader = sap.ui.core.Fragment.byId(sFragmentId, "idFileUploader");
                var oPhotoPreview = sap.ui.core.Fragment.byId(sFragmentId, "idPhotoPreview");
                if (oFileUploader && typeof oFileUploader.clear === "function") {
                    oFileUploader.clear();
                }
                if (oPhotoPreview && typeof oPhotoPreview.setSrc === "function") {
                    oPhotoPreview.setSrc("");
                }
            } catch (e) {
                // Si el fragmento no está cargado, no hacer nada
            }
            this.onChangeRow();
            if (oSearchQuotationPos < oActualQuotationPos) {
                const oModel = this.getView().getModel("serviceModel");
                var aGeneralPos = oModel.getProperty("/ScheduleLine/Items");

                if ((typeof oSearchQuotationPos !== "undefined" || oSearchQuotationPos !== "")) {
                    oSearchQuotationPos += 1
                    this.onSetValuePosition(aGeneralPos[oSearchQuotationPos]);
                } else if (oSearchQuotationPos === 0) {
                    this.onSetValuePosition(aGeneralPos[1]);
                }
            } else if (oSearchQuotationPos = oActualQuotationPos) {
                const oModel = this.getView().getModel("serviceModel");
                var aGeneralPos = oModel.getProperty("/ScheduleLine/Items");
                this.onSetValuePosition(aGeneralPos[oActualQuotationPos]);
            }
        },

        onSetValuePosition: function (data) {
            var sFragmentId = this.createId("myDialog");
            var oGlobalModel = this.getView().getModel("globalModel");
            var oGlobalModel1 = this.getView().getModel("globalModelNoEditables");
            if (oEditstatus === true) {
                oGlobalModel.setProperty("/enabled", false);
                oGlobalModel1.setProperty("/enableds", true);
            }
            /*Begin Set Title with Position */
            var oDialog = sap.ui.core.Fragment.byId(sFragmentId, "myDialog");
            oDialog.setTitle(oBuni18n.getText("titlePos") + " " + (data?.EBELP || ""));
            /*End set Title with Position */

            //sap.ui.core.Fragment.byId(sFragmentId, "idMatnrSelect").setText(data?.LINENAME || "");

            sap.ui.core.Fragment.byId(sFragmentId, "lineTitle").setText(data?.LINENAME || "");
            sap.ui.core.Fragment.byId(sFragmentId, "lineAvatar").setSrc(data?.IMAGE_SRC || "");

            sap.ui.core.Fragment.byId(sFragmentId, "idMENGETotal").setText(data?.MENGE || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idMENGEAdd").setText(data?.QTY_AVA || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd").setValue(data?.QTY_DELIV_COPY);
            sap.ui.core.Fragment.byId(sFragmentId, "idMENGEReceive").setText(data?.QTY_DELIV);

            //Comment
            sap.ui.core.Fragment.byId(sFragmentId, "idTextArea").setValue(data?.COMMENT);

            var oSlider = sap.ui.core.Fragment.byId(sFragmentId, "IdSliderKTMNG");

            var iMax = 0;
            var iAva = 0;
            if (smodeId === "a") {
                iMax = parseInt(data?.QTY_AVA);
            } else {
                var iReserved = data.RESERVED_MENGE ? data.RESERVED_MENGE : 0;
                iAva = parseInt(data?.QTY_AVA) - parseInt(iReserved);
                iMax = parseInt(iReserved) + iAva;
            }
            oSlider.setMax(iMax);
            oSlider.setValue(parseInt(data?.QTY_DELIV_COPY));

            var oSwitch = sap.ui.core.Fragment.byId(sFragmentId, "switchSTATUS");
            oSwitch.setState(data?.RECEP_XDIFICA);

            var oObjStatus = sap.ui.core.Fragment.byId(sFragmentId, "objDetailStatus");
            var iStat = parseInt(data?.STATUS);
            var oLineStatus = this._getStatusObj(iStat);
            oObjStatus.setText(oLineStatus.STATUS_TEXT);
            oObjStatus.setIcon(oLineStatus.STATUS_ICON);
            oObjStatus.setState(oLineStatus.STATUS_STATE);

            //Si la posición está borrada
            if (iStat === 3) {
                oSwitch.setEnabled(false);
                oSlider.setEnabled(false);
                sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd").setEnabled(false);
                //sap.ui.core.Fragment.byId(sFragmentId, "idMENGE_C").setEnabled(false);
                //sap.ui.core.Fragment.byId(sFragmentId, "idLOCACAdd").setEnabled(false);
            }

            // Set values for DatePickers
            sap.ui.core.Fragment.byId(sFragmentId, "IdEINDTDatePicker").setDateValue(data?.EINDT ? new Date(data?.EINDT) : null);
            if ((smodeId === "a" || smodeId === "r") && !data?.EINDT && oEditstatus === true) {
                sap.ui.core.Fragment.byId(sFragmentId, "IdEINDTDatePicker").setValue(currentDate.toISOString().split("T")[0]);
            } else {
                sap.ui.core.Fragment.byId(sFragmentId, "IdEINDTDatePicker").setValue(data?.EINDT);
            }

            sap.ui.core.Fragment.byId(sFragmentId, "idCATEGORY").setText(data?.["CATEGORY"] || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idFAMILY").setText(data?.["FAMILY"] || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idBRAND").setText(data?.["BRAND"] || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idMODEL").setText(data?.["MODEL"] || "");

            sap.ui.core.Fragment.byId(sFragmentId, "idDIMENSIONS").setText(data?.["DIMENSIONS"] || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idSTANDARD_IND").setState(data?.["STANDARD_IND"] || false);
            sap.ui.core.Fragment.byId(sFragmentId, "idIND_ACT_FIJO").setState(data?.["IND_ACT_FIJO"] || false);
            sap.ui.core.Fragment.byId(sFragmentId, "idHERITAGE").setState(data?.["HERITAGE"] || false);
            sap.ui.core.Fragment.byId(sFragmentId, "idSPECIALS").setState(data?.["SPECIALS"] || false);
            sap.ui.core.Fragment.byId(sFragmentId, "idFFE").setState(data?.["FFE"] || false);

            sap.ui.core.Fragment.byId(sFragmentId, "idDIVISION").setText(data?.["DIVISION"] || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idAREA").setText(data?.["AREA"] || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idLOCATION").setText(data?.["LOCATION"] || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idSUBLOCATION").setText(data?.["SUBLOCATION"] || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idSUPPLIED").setText(data?.["SUPPLIED"] || "");
            sap.ui.core.Fragment.byId(sFragmentId, "idVIEW").setText(data?.["VIEW"] || "");

            var oLink = sap.ui.core.Fragment.byId(sFragmentId, "idLinkHideFormDetail");
            this.hideFormDetail(oLink, true);
        },

        onliveChangeMaskToNumeric: function (oEvent) {
            let input = oEvent.getSource();
            let inputId = input.getId();
            let inpt = inputId.split("--").pop();
            let domRef = input.getDomRef("inner"); // Obtén el DOM de la entrada
            let cursorPos = domRef.selectionStart; // Guarda la posición del cursor
            let regex; let maxAllowedValue;

            let rawValue = input.getValue();
            let cleanValue = rawValue.replace(/[^\d.]/g, "");

            // Evitar múltiples puntos decimales
            cleanValue = cleanValue.replace(/(\..*)\./g, "$1");
            // Eliminar cualquier coma previamente introducida
            //let cleanValue = sCleanValue.replace(/,/g, "");

            // Si el valor está vacío o no es un número, no procesar
            if (isNaN(cleanValue) || cleanValue === "") {
                // Establecer el valor formateado
                //input.setValue(cleanValue);
                //return;
                cleanValue = 0;
            }

            let number = parseFloat(cleanValue);
            if (isNaN(number)) {
                //return;
                number = 0;
            }

            var sFragmentId = this.createId("myDialog");
            //var sMenge = sap.ui.core.Fragment.byId(sFragmentId, "idMENGEAdd").getText();
            var oSlider = sap.ui.core.Fragment.byId(sFragmentId, "IdSliderKTMNG");
            var iMenge = parseInt(oSlider.getMax());
            //var iMenge = parseFloat(sMenge);
            var iNewValue = number;
            if (iNewValue > iMenge) {
                number = parseInt(iMenge);
                sap.ui.core.Fragment.byId(sFragmentId, "IdSliderKTMNG").setValue(iMenge);
                sap.m.MessageToast.show(oBuni18n.getText("validateMenge"));
            } else {
                sap.ui.core.Fragment.byId(sFragmentId, "IdSliderKTMNG").setValue(number);
            }

            // Formatear el valor a 2 decimales y con separadores de miles
            formattedValue = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
                useGrouping: true
            }).format(number);

            sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd").setValue(formattedValue);
            sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd").setValueState(sap.ui.core.ValueState.None);

            // Asegurarnos de mantener el cursor en la posición correcta
            setTimeout(() => {
                let newCursorPos = this.getCursorPositionAfterFormatting(rawValue, formattedValue, cursorPos);
                domRef.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);
        },

        _getFormatValueQuantity: function (rawValue) {
            rawValue = rawValue.toString();
            let cleanValue = rawValue.replace(/[^\d.]/g, "");
            cleanValue = cleanValue.replace(/(\..*)\./g, "$1");
            let number = parseFloat(cleanValue);
            formattedValue = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
                useGrouping: true
            }).format(number);
            return formattedValue;
        },

        onChnageSlideBarQuantity: function (oEvent) {
            var sFragmentId = this.createId("myDialog");
            var newValue = oEvent.getParameter("value");
            //var sMenge = sap.ui.core.Fragment.byId(sFragmentId, "idMENGEAdd").getText(newValue);
            //var iMenge = parseFloat(sMenge);

            var oSlider = sap.ui.core.Fragment.byId(sFragmentId, "IdSliderKTMNG");
            var iMenge = parseInt(oSlider.getMax());

            var iNewValue = parseFloat(newValue);
            var bValid = true;
            if (iNewValue > iMenge) {
                newValue = parseInt(iMenge);
                sap.ui.core.Fragment.byId(sFragmentId, "IdSliderKTMNG").setValue(iMenge);
                sap.m.MessageToast.show(oBuni18n.getText("validateMenge"));
                bValid = false;
            }

            sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd").setValue(this._getFormatValueQuantity(newValue));
            sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd").setValueState(sap.ui.core.ValueState.None);
            return bValid;
        },

        onValidateQuantity: function () {
            var sFragmentId = this.createId("myDialog");
            var newValue = sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd").getValue();
            var iNewValue = parseFloat(newValue);
            var oSlider = sap.ui.core.Fragment.byId(sFragmentId, "IdSliderKTMNG");
            var iMax = parseInt(oSlider.getMax());
            if (iNewValue > iMax) {
                newValue = parseInt(iMax);
                sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd").setValue(newValue);
                sap.m.MessageToast.show(oBuni18n.getText("validateMenge"));
            } else {
                newValue = iNewValue;
            }

            sap.ui.core.Fragment.byId(sFragmentId, "IdSliderKTMNG").setValue(newValue);
            sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd").setValueState(sap.ui.core.ValueState.None);

        },

        onDelete: function (oEvent) {
            var res;
            var that = this;
            const oTable = this.byId("ItemsTable"); // Obtener la tabla
            const aSelectedItems = oTable.getSelectedItems(); // Obtener elementos seleccionados
            if (aSelectedItems.length === 0) {
                sap.m.MessageToast.show(oBuni18n.getText("selectPosition"));
                return;
            }
            // Obtener el modelo y los datos actuales
            const oModel = this.getView().getModel("serviceModel");
            let aData = oModel.getProperty("/ScheduleLine/Items");

            let aSelectedDataItems = aSelectedItems.map(oItem => {
                return oItem.getBindingContext("serviceModel").getObject();
            });

            // Filtrar los elementos que NO fueron seleccionados
            aData = aData.filter(function (item) {
                return !aSelectedDataItems.includes(item) ? true : false;
            });

            //Add items to aDelPos array
            /*
            aSelectedDataItems.forEach(line => {
                if (line.LINE_STATUS === "E") {
                    line.STATU = 2;
                    aDelPos.push(line);
                }
            });
            */
            var aEspecial = [];
            aSelectedDataItems.forEach(line => {
                line.STATU = 2;
                line.STATUS = 2;
                var oLineStatus = that._getStatusObj(parseInt(line.STATU));
                line.STATUS_TEXT = oLineStatus.STATUS_TEXT;
                line.STATUS_ICON = oLineStatus.STATUS_ICON;
                line.STATUS_STATE = oLineStatus.STATUS_STATE;
                line.QTY_DELIV = that._getFormatValueQuantity(0);
                /*
                if (line.BANFN && line.BNFPO) {
                    var oDelItem = {
                        BANFN: line.BANFN,
                        BNFPO: line.BNFPO,
                        MENGE_C: 0
                    };
                    aEspecial.push(oDelItem);
                }
                */
            });

            /*
            if (aEspecial.length > 0) {
                //Actualizo Requirement MENGE_C=0
                this._updateSpecialData(aEspecial);
            }
            */

            //Solo items ya guardados previamente
            aSelectedDataItems = aSelectedDataItems.filter(function (item) {
                return item.LINE_STATUS === "E" ? true : false;
            });

            //agrego lineas para mantener visibles posiciones
            aData = aData.concat(aSelectedDataItems);
            aData.sort((a, b) => a.EBELP - b.EBELP);

            if (smodeId === "a") {
                //reset EBELP
                let oItemsArraylength = 0;
                let oPosI;
                for (var i = 0; i < aData.length; i++) {
                    oItemsArraylength += 10;
                    oPosI = this.addLeadingZeros(oItemsArraylength, 4);
                    aData[i].EBELP = oPosI;
                }
            } else {
                let oItemsArraylength = 0;
                let oPosI;
                oItemsArraylength = sOrgMaxPos;
                for (var i = 0; i < aData.length; i++) {
                    if (aData[i].LINE_STATUS === "N") {
                        oItemsArraylength += 10;
                        oPosI = this.addLeadingZeros(oItemsArraylength, 4);
                        aData[i].EBELP = oPosI;
                    }
                }

                //Max Position of Array
                sMaxPos = Math.max(...aData.map(oObj => oObj.EBELP));
                if (sMaxPos < sOrgMaxPos) {
                    sMaxPos = sOrgMaxPos;
                }

            }

            // Actualizar el modelo con los datos filtrados
            oModel.setProperty("/ScheduleLine/Items", aData);
            // Limpiar selección después de eliminar
            oTable.removeSelections();
            // Mostrar mensaje de confirmación
            //sap.m.MessageToast.show(oBuni18n.getText("deletePos"));

        },

        _removeSpecialsSelections: function (bSelectAll) {
            const oTable = this.byId("ItemsTable"); // Obtener la tabla
            const aSelectedItems = oTable.getSelectedItems(); // Obtener elementos seleccionados
            var oModel = this.getView().getModel("serviceModel");
            var bRemove = false;
            for (var i = 0; i < aSelectedItems.length; i++) {
                var sPath = aSelectedItems[i].getBindingContextPath();
                var oLine = oModel.getProperty(sPath);
                if (parseInt(oLine.STATU) === 3) {
                    aSelectedItems[i].setSelected(false);
                    bRemove = true;
                }
            }

            if (bRemove) {
                var sText = bSelectAll ? oBuni18n.getText("unSelectAll") : oBuni18n.getText("unSelectItem");
                sap.m.MessageToast.show(sText);
            }
        },

        onSelectionChangeReference: function (oEvent) {
            var oTable = this.byId("ItemsTable");
            var oModel = oTable.getModel();
            var aAddedItems = oModel.getProperty("/ScheduleLine/Items");
            if (aAddedItems.length > 0) {
                var oRefTable = oEvent.getSource();
                var oRefModel = this.getView().getModel("serviceModel");
                var aSelectedItems = oRefTable.getSelectedItems();
                var bAdded = false;
                for (var i = 0; i < aSelectedItems.length; i++) {
                    var sPath = aSelectedItems[i].getBindingContextPath();
                    var oLine = oRefModel.getProperty(sPath);
                    var linMat = aAddedItems.find(item => item.MAT_MATNR === oLine.MATNR && item.BANFN === oLine.BANFN && item.BNFPO === oLine.BNFPO && parseInt(item.STATUS) === 1);
                    if (linMat) {
                        aSelectedItems[i].setSelected(false);
                        bAdded = true;
                    }
                }

                if (bAdded) {
                    var sText = oBuni18n.getText("unSelectItemRef");
                    sap.m.MessageToast.show(sText);
                }
            }
        },

        onPressDetail: function (oEvent) {
            var that = this;
            sap.ui.core.BusyIndicator.show();
            setTimeout(function () {
                that._showDialogDetail(oEvent);
            }, 50);
        },
        /*
        _showDialogDetail: function (oEvent) {
            console.log("Se ejecuta showDialogDetail")
            let oButton = oEvent.getSource();
            let oData = oButton.getBindingContext("serviceModel").getObject();
            let sPath = oButton.getBindingContext("serviceModel").getPath();
            iIndex = parseInt(sPath.split("/").pop(), 10);
            console.log(iIndex);
            const oModel = this.getView().getModel("serviceModel");
            console.log(oModel);
            aJsonCreate = oModel.getProperty("/ScheduleLine/Items");
            console.log(aJsonCreate);
            var row = FragmentMap.find(function (fragment) {
                return fragment.DialogID === "myDialog";
            });
            oFlagPos = true;
            console.log(row.DialogRout);
            console.log(row.DialogID);

            this.openValueHelpDialog(row.DialogRout, oEvent, row.DialogID);
        },
        */
        // Offline
        /*
        _showDialogDetail: function (oEvent) {
            let oButton = oEvent.getSource();
            let oData = oButton.getBindingContext("serviceModel").getObject();
            let sPath = oButton.getBindingContext("serviceModel").getPath();
            iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getView().getModel("serviceModel");
            // Siempre obtén el arreglo actual justo antes de abrir el fragmento
            aJsonCreate = oModel.getProperty("/ScheduleLine"); // <-- Usa el objeto completo, no solo Items
            console.log(aJsonCreate);
            var row = FragmentMap.find(function (fragment) {
                return fragment.DialogID === "myDialog";
            });
            oFlagPos = true;

            this.openValueHelpDialog(row.DialogRout, oEvent, row.DialogID);
        },
        */

        _showDialogDetail: function (oEvent) {
            // Obtén el índice del item de la tabla seleccionado
            let oButton = oEvent.getSource();
            let sPath = oButton.getBindingContext("serviceModel").getPath();
            iIndex = parseInt(sPath.split("/").pop(), 10);

            // Obtén SIEMPRE el objeto actual del modelo
            const oModel = this.getView().getModel("serviceModel");
            oJsonCreate = oModel.getProperty("/ScheduleLine"); // <-- Objeto completo, no solo Items

            // Busca el fragmento
            var row = FragmentMap.find(function (fragment) {
                return fragment.DialogID === "myDialog";
            });

            // Flag para indicar que se va a mostrar posición
            oFlagPos = true;

            // Abre el fragmento con los datos actuales
            this.openValueHelpDialog(row.DialogRout, oEvent, row.DialogID);
        },

        onChangeRow: function (oEvent) {
            //this.onValidateQuantity();
            var sFragId = this.createId("myDialog");
            var oInputControl = sap.ui.core.Fragment.byId(sFragId, "idWEMNGAdd");
            // Get the ValueState of the control
            var valueState = oInputControl.getValueState();

            if (valueState !== "Error") {

                let oItemsPos = []; const sSubstring = "REQ1";
                var oTable = this.byId("ItemsTable");
                var oBinding = oTable.getBinding("items");
                var oModel1 = oBinding.getModel();
                var sPath = oBinding.getPath();
                var aData = oModel1.getProperty(sPath);
                var aRow = aData[oSearchQuotationPos];
                let updatedData, vIncluded;
                if (aUpdateRequerments.length === 0) {
                    vIncluded = true;
                }
                if (aRow !== undefined) {

                    var sFragmentId = this.createId("myDialog");
                    var oInputidWEMNGAddAdd = sap.ui.core.Fragment.byId(sFragmentId, "idWEMNGAdd");
                    var oInputidComment = sap.ui.core.Fragment.byId(sFragmentId, "idTextArea");
                    var oInputEINDTAdd = sap.ui.core.Fragment.byId(sFragmentId, "IdEINDTDatePicker");
                    //var oInputLoca_CAdd = sap.ui.core.Fragment.byId(sFragmentId, "idLOCACAdd");
                    var oSwitch = sap.ui.core.Fragment.byId(sFragmentId, "switchSTATUS");
                    updatedData = aData.map((row) => {
                        if (row.EBELP === aRow.EBELP) {
                            row.EINDT = oInputEINDTAdd.getValue();
                            row.WEMNG = oInputidWEMNGAddAdd.getValue();
                            row.ERNAM2 = sUserName;
                            //row.LOCAC = oInputLoca_CAdd.getValue();
                            row.QTY_DELIV_COPY = oInputidWEMNGAddAdd.getValue();
                            row.COMMENT = oInputidComment.getValue();
                            row.RECEP_XDIFICA = oSwitch.getState();
                        }
                        return row; // Leave if condition is false
                    });
                    const oModel = this.getView().getModel("serviceModel");
                    oModel.setProperty("/ScheduleLine/Items", updatedData);
                }

            }
        },
        onOpenColumnSettings: function () {
            this.byId("columnSettingsDialog").open();
        },

        onCloseColumnSettings: function () {
            this.byId("columnSettingsDialog").close();
        },

        onToggleColumnVisibility: function (oEvent) {
            let sColumn = oEvent.getSource().getTitle();
            let oModel = this.getView().getModel("createSettingsModelItem");
            let bCurrentValue = oModel.getProperty("/" + sColumn);
            oModel.setProperty("/" + sColumn, !bCurrentValue);
        },

        addLeadingZeros: function (number, length) {
            return number.toString().padStart(length, '0');
        },

        onValidateStatusHeadChange: function (aCot) {
            aCot.forEach(line => {
                if (line.CONF !== "4" && line.CONF !== "5") {
                    if (line.KTMNG !== "0") {
                        sStatusHeaderQuoatation = "2";
                        line.CONF = "2";
                    }
                }
            });
        },

        onValidateStatusHeadCreation: function (aCot) {
            aCot.forEach(line => {
                if (line.KTMNG !== "0") {
                    sStatusHeaderQuoatation = "2";
                    line.CONF = "2";
                } else {
                    sStatusHeaderQuoatation = "1";
                }
            });
        },

        onPutUserInformation: function (oEvent) {
            const sBaseUrl = host + "/User/" + sUserName;
            var xhr = new XMLHttpRequest();
            // Open the request (synchronous)
            xhr.open("PUT", sBaseUrl, false);  // false means synchronous request
            xhr.setRequestHeader("Content-Type", "application/json");
            // Send the request
            xhr.send(data);
            // Process the response after the request completes
            if (xhr.status === 200) {
                var response = JSON.parse(xhr.responseText);
            } else {
                xhr.statusText;
            }
        },

        // Función que calcula la nueva posición del cursor
        getCursorPositionAfterFormatting: function (rawValue, formattedValue, cursorPos) {
            let rawLength = rawValue.length;
            let formattedLength = formattedValue.length;
            let diff = formattedLength - rawLength;

            if (cursorPos === rawLength) {
                return rawLength;//formattedLength;
            } else if (cursorPos === 0) {
                var vLength = formattedLength + 1;
                return vLength;
            }

            return cursorPos + diff;
        },

        onDateChangePos: function (oEvent) {
            var oDatePicker = oEvent.getSource();
            var sSelectedDate = oDatePicker.getDateValue();
            if (sSelectedDate) {
                var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
                var sFormattedDate = oDateFormat.format(sSelectedDate);
                var oTable = this.byId("ItemsTable");
                var oBinding = oTable.getBinding("items");
                var oModel1 = oBinding.getModel();
                var sPath = oBinding.getPath();
                var aData = oModel1.getProperty(sPath);
                aData.EINDT = sFormattedDate;
            }
        },

        validateRol: function (aJsonRol) {
            aJsonRol.forEach((oItem) => {
                if (oItem.CREATE === "X") {
                }
                if (oItem.EDIT === "X") {
                    //this.getView().byId("idBtnEdit").setVisible(true);
                    this.getView().byId("idBtnSave").setVisible(true);
                    //this.getView().byId("idBtnSave").setVisible(false);
                    this.getView().byId("idBtnCancel").setVisible(true);
                    //this.getView().byId("idBttonReference").setVisible(true);
                    this.getView().byId("idBttonReference").setVisible(false);
                }
                if (oItem.DELETE === "X") {
                    // this.getView().byId("switchLOEKZ").setVisible(true);
                    //this.getView().byId("IdLOEKZLabel").setVisible(true);
                }
                if (oItem.ERASED === "X") {
                    this.getView().byId("idBttonDelete").setVisible(true);
                }
            });
        },

        _setLifnrDesc: function (sId, sDesc) {
            var oGlobalModel = this.getView().getModel("globalModel");
            if (sId && sDesc) {
                oGlobalModel.setProperty("/lifnr", sId);
                //oGlobalModel.setProperty("/lifnr_des", sId + " - " + sDesc);
                oGlobalModel.setProperty("/lifnr_des", sDesc);
            } else {
                oGlobalModel.setProperty("/lifnr", "");
                oGlobalModel.setProperty("/lifnr_des", "");
                this._removeItemsFromTable();
            }
            oGlobalModel.refresh();
        },

        _cleanViewFields: function () {
            //clean aIdCONTRA
            aIdCONTRA = [];
            var oMultiInput = this.getView().byId("ID_CON");
            oMultiInput.removeAllTokens();

            //clean lifnr field
            this._setLifnrDesc();
        },

        _removeItemsFromTable: function () {
            oJsonCreate = [{
                "EBELN": "",
                "ID_PEP": "",
                "PSPNR": "",
                "STATUS": null,
                "ERNAM": "",
                "Items": []
            }];

            oItemsArray = [];
            const oModel = this.getView().getModel("serviceModel");
            oJsonCreate["Items"] = [];
            oModel.setProperty("/ScheduleLine", oJsonCreate);
            oModel.refresh();
            this.byId("ItemsTable").setModel(oModel);
        },


        onUpdateFinished: function (oEvent) {
            var iTotalItems = oEvent.getParameter("total");
            oBuni18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            var sTitle = oBuni18n.getText("titleProj", [iTotalItems]);
            var oGlobalModel = this.getView().getModel("globalModel");
            oGlobalModel.setProperty("/titleProj", sTitle);
            oGlobalModel.refresh();
        },

        /*
        _getRefEspecialData: function (aRespData, oSuccessMaterials) {
            var that = this;
            let aFilterItems = [];
            let aItemsArray = [];
            let oItemReq = [];
            if (aRespData.items !== undefined) {
                oItemReq = aRespData.items;
            }
    
            aFilterItems = oItemReq
                .filter(line => {
                    let linMat = oSuccessMaterials.find(item => item.MATNR === line.MATNR && item.BANFN === line.BANFN && item.BNFPO === line.BNFPO);
                    if (linMat) {
                        line.MATERIALNAME = linMat.MATKT;
                        var oLineStatus = that._getStatusObj(parseInt(line.STATU));
                        const oNewRow = {
    
                            EBELP: line.EBELP,
                            //ID_CON: data.ID_CON,
                            //CONPO: data.CONPO,
                            IMAG: (line.IMAGE) ? line.IMAGE : 'N/A',
                            IMAG_ENAB: (line.IMAGE) ? true : false,
                            MAT_MATNR: line.MATNR,
                            MAT_NAME: linMat.MATERIALNAME,
                            LINENAME: that._getLineText(line.MATNR, linMat.MATERIALNAME),
                            MENGE: line.MENGE,
                            MEINS: line.MEINS,
                            QTY_DELIV: line.WEMNG,
                            RECEP_XDIFICA: (linMat.EMXDI === "X") ? true : false,
                            EINDT: line.EINDT,
                            CAT_ID: linMat.CAT_ID,
                            CAT_DESC: linMat.CAT_DESC,
                            CATEGORY: that._getLineText(linMat.CAT_ID, linMat.CAT_DESC),
                            FAM_ID: linMat.FAM_ID,
                            FAM_DESC: linMat.FAM_DESC,
                            FAMILY: that._getLineText(linMat.FAM_ID, linMat.FAM_DESC),
                            BRA_ID: linMat.BRA_ID,
                            BRA_DESC: linMat.BRA_DESC,
                            BRAND: that._getLineText(linMat.BRA_ID, linMat.BRA_DESC),
                            MOD_ID: linMat.MOD_ID,
                            MOD_DESC: linMat.MOD_DESC,
                            MODEL: that._getLineText(linMat.MOD_ID, linMat.MOD_DESC),
                            DIMENSIONS: linMat.MAT_DIMENS,
                            STANDARD_IND: (linMat.MAT_IND_STAN === "X") ? true : false,
                            IND_ACT_FIJO: (linMat.MAT_IND_ASSET === "X") ? true : false,
                            HERITAGE: (linMat.MAT_PATR === "X") ? true : false,
                            SPECIALS: true,
                            FFE: (linMat.MAT_FFE === "X") ? true : false,
                            DIV_ID: linMat.DIV_ID,
                            DIV_DESC: linMat.DIV_DESC,
                            DIVISION: that._getLineText(linMat.DIV_ID, linMat.DIV_DESC),
                            AREA_ID: linMat.AREA_ID,
                            AREA_DESC: linMat.AREA_DESC,
                            AREA: that._getLineText(linMat.AREA_ID, linMat.AREA_DESC),
                            LOCATION: linMat.UBICA,
                            SUBLOCATION: linMat.SUBIC,
                            REQ_SUMIN: linMat.SUMIN,
                            REQ_SUMIN_DESC: linMat.REQ_SUMIN_DESC,
                            SUPPLIED: that._getLineText(linMat.SUMIN, linMat.REQ_SUMIN_DESC),
                            REQ_VISTA: linMat.VISTA,
                            REQ_VISTA_DESC: linMat.REQ_VISTA_DESC,
                            VIEW: that._getLineText(linMat.VISTA, linMat.REQ_VISTA_DESC),
                            STATU: line.STATU,
                            STATUS_TEXT: oLineStatus.STATUS_TEXT,
                            STATUS_ICON: oLineStatus.STATUS_ICON,
                            STATUS_STATE: oLineStatus.STATUS_STATE,
    
                            //pending
                            BANFN: (linMat?.BANFN || ""),
                            BNFPO: (linMat?.BNFPO || ""),
                            ERNAM: (line?.ERNAM || ""),
                            CREATION_NAME: sFName,
                            CREATION_LNAME: sLName,
                            CREATION_EMAIL: sEmail,
    
                            //Line Exist
                            LINE_STATUS: "E"
                        };
                        aItemsArray.push(oNewRow);
                        return true; // Keep the entry
                    }
                    return false; // Remove the entry
                });
    
            return aItemsArray;
        },
        */

        _getRefEspecialData: function (aRespData, oSuccessMaterials) {
            var that = this;
            let aFilterItems = [];
            let aItemsArray = [];
            let oItemReq = [];
            if (aRespData.items !== undefined) {
                oItemReq = aRespData.items;
            }

            var aReceptMat = this.aReceptMaterials;

            aFilterItems = oItemReq
                .filter(line => {
                    if (!line.CONTR && !line.CONPS) {
                        var oLineStatus = that._getStatusObj(parseInt(line.STATU));

                        //Verifico recepcion de material
                        var sQTY_DELIV_COPY = that._getFormatValueQuantity(line.WEMNG);
                        var sCOMMENT = "";
                        var sRESERVED_QTY_DELIV = that._getFormatValueQuantity(0);
                        var bRecep = false;
                        var oRecep = aReceptMat.find(item => item.PROGP === line.EBELP);
                        if (oRecep) {
                            sQTY_DELIV_COPY = oRecep.ERFMG;
                            sRESERVED_QTY_DELIV = oRecep.ERFMG;
                            sCOMMENT = oRecep.TEXT1;
                            bRecep = true;
                        }
                        //Verifico recepcion de material


                        const oNewRow = {

                            EBELP: line.EBELP,
                            //ID_CON: data.ID_CON,
                            //CONPO: data.CONPO,
                            IMAG: (line.IMAGE) ? line.IMAGE : 'N/A',
                            IMAG_ENAB: (line.IMAGE) ? true : false,
                            IMAGE_SRC: host + "/ImageMaterial/" + line.MATNR,
                            MAT_MATNR: line.MATNR,
                            MAT_NAME: line.MAT_NAME,
                            LINENAME: that._getLineText(line.MATNR, line.MAT_NAME),

                            //Quantity
                            MENGE: line.MENGE,
                            QTY_AVA: that._getFormatValueQuantity(line.EBAN_AVAIL),
                            QTY_DELIV: that._getFormatValueQuantity(line.WEMNG),
                            QTY_DELIV_COPY: sQTY_DELIV_COPY,
                            RESERVED_QTY_DELIV: sRESERVED_QTY_DELIV,
                            B_RESERVED: bRecep,
                            COMMENT: sCOMMENT,
                            MENGE_C: line.MENGE_C,
                            RESERVED_MENGE: that._getFormatValueQuantity(line.WEMNG),
                            MEINS: line.MEINS,

                            RECEP_XDIFICA: (line.EMXDI === "X") ? true : false,
                            EINDT: line.EINDT,
                            CAT_ID: line.CAT_ID,
                            CAT_DESC: line.CAT_DESC,
                            CATEGORY: that._getLineText(line.CAT_ID, line.CAT_DESC),
                            FAM_ID: line.FAM_ID,
                            FAM_DESC: line.FAM_DESC,
                            FAMILY: that._getLineText(line.FAM_ID, line.FAM_DESC),
                            BRA_ID: line.BRA_ID,
                            BRA_DESC: line.BRA_DESC,
                            BRAND: that._getLineText(line.BRA_ID, line.BRA_DESC),
                            MOD_ID: line.MOD_ID,
                            MOD_DESC: line.MOD_DESC,
                            MODEL: that._getLineText(line.MOD_ID, line.MOD_DESC),
                            DIMENSIONS: line.MAT_DIMENS,
                            STANDARD_IND: (line.MAT_IND_STAN === "X") ? true : false,
                            IND_ACT_FIJO: (line.MAT_IND_ASSET === "X") ? true : false,
                            HERITAGE: (line.MAT_PATR === "X") ? true : false,
                            SPECIALS: true,
                            FFE: (line.MAT_FFE === "X") ? true : false,
                            DIV_ID: line.DIV_ID,
                            DIV_DESC: line.DIV_DESC,
                            DIVISION: that._getLineText(line.DIV_ID, line.DIV_DESC),
                            AREA_ID: line.AREA_ID,
                            AREA_DESC: line.AREA_DESC,
                            AREA: that._getLineText(line.AREA_ID, line.AREA_DESC),
                            LOCATION: line.EBAN_UBICA,
                            SUBLOCATION: line.REQ_SUBIC, //--falta
                            REQ_SUMIN: line.EBAN_SUMIN,
                            REQ_SUMIN_DESC: line.REQ_SUMIN_DESC,
                            SUPPLIED: that._getLineText(line.EBAN_SUMIN, line.REQ_SUMIN_DESC),
                            REQ_VISTA: line.EBAN_VISTA,
                            REQ_VISTA_DESC: line.REQ_VISTA_DESC,
                            VIEW: that._getLineText(line.EBAN_VISTA, line.REQ_VISTA_DESC),
                            STATU: line.STATU,
                            STATUS: line.STATU,
                            STATUS_TEXT: oLineStatus.STATUS_TEXT,
                            STATUS_ICON: oLineStatus.STATUS_ICON,
                            STATUS_STATE: oLineStatus.STATUS_STATE,

                            //pending
                            BANFN: (line?.BANFN || ""),
                            BNFPO: (line?.BNFPO || ""),
                            ERNAM: (line?.ERNAM || ""),
                            CREATION_NAME: sFName,
                            CREATION_LNAME: sLName,
                            CREATION_EMAIL: sEmail,

                            EBELN_MAT: line.EBELN,
                            EBELP_MAT: line.EBELP,

                            //Line Exist
                            LINE_STATUS: "E"
                        };
                        aItemsArray.push(oNewRow);
                        return true; // Keep the entry
                    }
                    return false; // Remove the entry
                });

            return aItemsArray;
        },

        handleLinkPress: function (oEvent) {
            var sFragmentId = this.createId("myDialog");
            var oHBOXDetail = sap.ui.core.Fragment.byId(sFragmentId, "idMoreDetails");
            var bVisible = oHBOXDetail.getVisible();
            this.hideFormDetail(oEvent.getSource(), bVisible);
        },

        hideFormDetail: function (oLink, bVisible) {
            var sFragmentId = this.createId("myDialog");
            var oHBOXDetail = sap.ui.core.Fragment.byId(sFragmentId, "idMoreDetails");
            oHBOXDetail.setVisible(!bVisible);
            if (!bVisible) {
                oLink.setText(oBuni18n.getText("hideDetail"));
            } else {
                oLink.setText(oBuni18n.getText("moreDetail"));
            }
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

        _scrollToHeader: function () {
            this.byId("ObjectPageLayout")._scrollTo(0, 0);
        },

        onPressImage: function (oEvent) {
            var oButton = oEvent.getSource(),
                that = this,
                oView = this.getView(),
                sFragmentId = this.createId("myDialog");

            var sSrc = sap.ui.core.Fragment.byId(sFragmentId, "lineAvatar").getSrc();
            var sText = sap.ui.core.Fragment.byId(sFragmentId, "lineTitle").getText();

            // create popover
            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "com.xcaret.recepcionarticulosoff.fragments.MaterialImage",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);

                    that._oImagePop = oPopover;
                    return oPopover;
                });
            }
            this._pPopover.then(function (oPopover) {
                oPopover.setTitle(sText);
                oPopover.getContent()[0].setSrc(sSrc);
                oPopover.openBy(oButton);
            });
        },

        handleClose: function () {
            this._oImagePop.close();
        },

        /*
        onCapturePhoto: function () {
            var that = this;
            navigator.camera.getPicture(
                function (oImage) {
                    that._onAddImage(that, oImage);
                },
                this.onFail, {
                quality: 90,
                targetWidth: 300,
                targetHeight: 500,
                sourceType: navigator.camera.PictureSourceType.CAMERA,
                destinationType: navigator.camera.DestinationType.FILE_URI,
                encodingType: navigator.camera.EncodingType.JPEG,
                mediaType: navigator.camera.MediaType.PICTURE
            });
        },
        */
        // Usa cordova
        /*
        onCapturePhoto: function (oEvent) {
            var that = this;
            var sFragmentId = this.createId("myDialog");
            var oDialog = sap.ui.core.Fragment.byId(sFragmentId, "myDialog");
            var sTitle = oDialog.getTitle();
            var sTitlePos = oBuni18n.getText("titlePos") + " ";
            var sPosition = sTitle.split(sTitlePos)[1];
            var iIndex = this.getIndexByPos(sPosition);

            navigator.camera.getPicture(
                function (imageURI) {
                    window.resolveLocalFileSystemURL(imageURI, function (fileEntry) {
                        // Guarda el FileEntry, no el File
                        that._aImageSource.push({
                            pos: sPosition,
                            src: imageURI,
                            fileEntry: fileEntry,
                            filename: fileEntry.name,
                            index: iIndex,
                            ind: "n" // nueva imagen
                        });

                        sap.m.MessageToast.show("Foto agregada: " + fileEntry.name);
                    }, function (err) {
                        console.error("Error al resolver la URI:", err);
                    });
                },
                function (error) {
                    console.error("Error al tomar la foto:", error);
                },
                {
                    quality: 70,
                    destinationType: Camera.DestinationType.FILE_URI,
                    sourceType: Camera.PictureSourceType.CAMERA,
                    encodingType: Camera.EncodingType.JPEG,
                    mediaType: Camera.MediaType.PICTURE,
                    saveToPhotoAlbum: false,
                    correctOrientation: true
                }
            );
        },
        */
        // Ya funciona de manera online
        /*
        onCapturePhoto: function () {
            var that = this;
            var sFragmentId = this.createId("myDialog");
            var oDialog = sap.ui.core.Fragment.byId(sFragmentId, "myDialog");
            var oPreview = sap.ui.core.Fragment.byId(sFragmentId, "idPhotoPreview"); // Si tienes un control de preview
            var sTitle = oDialog.getTitle();
            var sTitlePos = oBuni18n.getText("titlePos") + " ";
            var sPosition = sTitle.split(sTitlePos)[1];
            var index = this.getIndexByPos(sPosition);

            // Crea el HTML para video y canvas
            var oHtml = new sap.ui.core.HTML({
                content: `
                    <div style="text-align:center;">
                        <video id="webcamVideo" width="320" height="240" autoplay style="border:1px solid #ccc"></video>
                        <br>
                        <button id="captureBtn" style="margin-top:10px">Capturar foto</button>
                        <br>
                        <canvas id="webcamCanvas" width="320" height="240" style="display:none;margin-top:10px;border:1px solid #ccc"></canvas>
                    </div>
                `
            });

            // Diálogo SAPUI5 para la cámara
            var oCamDialog = new sap.m.Dialog({
                title: "Capturar foto con cámara",
                content: [oHtml],
                endButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        // Detén la cámara
                        let video = document.getElementById("webcamVideo");
                        if (video && video.srcObject) {
                            video.srcObject.getTracks().forEach(t => t.stop());
                        }
                        oCamDialog.close();
                        oCamDialog.destroy();
                    }
                }),
                afterOpen: function () {
                    // Solicita permiso y muestra la cámara
                    navigator.mediaDevices.getUserMedia({ video: true })
                        .then(function (stream) {
                            let video = document.getElementById("webcamVideo");
                            video.srcObject = stream;
                        })
                        .catch(function (err) {
                            sap.m.MessageToast.show("No se pudo acceder a la cámara: " + err);
                            oCamDialog.close();
                        });

                    // Evento de captura
                    document.getElementById("captureBtn").onclick = function () {
                        let video = document.getElementById("webcamVideo");
                        let canvas = document.getElementById("webcamCanvas");
                        let ctx = canvas.getContext("2d");
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        canvas.style.display = "block";

                        // *** CAMBIO CLAVE AQUÍ: Convierte a Blob en lugar de base64 ***
                        canvas.toBlob(function (blob) {
                            // Crea un objeto File a partir del Blob para que coincida con la estructura de imgData.file
                            const capturedFile = new File([blob], 'CAPTURA_' + Date.now() + '.jpeg', { type: 'image/jpeg' });

                            // 1. Agrega la imagen al arreglo auxiliar con la propiedad 'file'
                            that._aImageSource.push({
                                pos: sPosition,
                                src: URL.createObjectURL(blob), // Opcional: Si aún quieres una URL para preview
                                filename: capturedFile.name,
                                ind: 'n',
                                index: index,
                                file: capturedFile // Aquí es donde guardamos el objeto File/Blob
                            });

                            // 2. (Opcional) Mostrar preview visual si tienes un control para ello
                            if (oPreview) {
                                oPreview.setSrc(URL.createObjectURL(blob)); // Usa la URL del Blob para el preview
                                oPreview.setVisible(true);
                            }

                            sap.m.MessageToast.show("Foto capturada correctamente.");

                            // Detén la cámara para liberar recursos
                            if (video.srcObject) {
                                video.srcObject.getTracks().forEach(t => t.stop());
                            }

                            // Cierra el diálogo
                            oCamDialog.close();
                            oCamDialog.destroy();

                        }, 'image/jpeg', 0.9); // Formato JPEG con calidad 0.9
                    };
                }
            });

            this.getView().addDependent(oCamDialog);
            oCamDialog.open();
        },
        */
        // Offline
        onCapturePhoto: function () {
            var that = this;
            var sFragmentId = this.createId("myDialog");
            var oDialog = sap.ui.core.Fragment.byId(sFragmentId, "myDialog");
            var oPreview = sap.ui.core.Fragment.byId(sFragmentId, "idPhotoPreview"); // Si tienes un control de preview
            var sTitle = oDialog.getTitle();
            var sTitlePos = oBuni18n.getText("titlePos") + " ";
            var sPosition = sTitle.split(sTitlePos)[1];
            var index = this.getIndexByPos(sPosition);

            // Crea el HTML para video y canvas
            var oHtml = new sap.ui.core.HTML({
                content: `
                    <div style="text-align:center;">
                        <video id="webcamVideo" width="320" height="240" autoplay style="border:1px solid #ccc"></video>
                        <br>
                        <button id="captureBtn" style="margin-top:10px">Capturar foto</button>
                        <br>
                        <canvas id="webcamCanvas" width="320" height="240" style="display:none;margin-top:10px;border:1px solid #ccc"></canvas>
                    </div>
                `
            });

            // Diálogo SAPUI5 para la cámara
            var oCamDialog = new sap.m.Dialog({
                title: "Capturar foto con cámara",
                content: [oHtml],
                endButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        // Detén la cámara
                        let video = document.getElementById("webcamVideo");
                        if (video && video.srcObject) {
                            video.srcObject.getTracks().forEach(t => t.stop());
                        }
                        oCamDialog.close();
                        oCamDialog.destroy();
                    }
                }),
                afterOpen: function () {
                    // Solicita permiso y muestra la cámara
                    navigator.mediaDevices.getUserMedia({ video: true })
                        .then(function (stream) {
                            let video = document.getElementById("webcamVideo");
                            video.srcObject = stream;
                        })
                        .catch(function (err) {
                            sap.m.MessageToast.show("No se pudo acceder a la cámara: " + err);
                            oCamDialog.close();
                        });

                    // Evento de captura
                    document.getElementById("captureBtn").onclick = function () {
                        let video = document.getElementById("webcamVideo");
                        let canvas = document.getElementById("webcamCanvas");
                        let ctx = canvas.getContext("2d");
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        canvas.style.display = "block";

                        // Convierte a Blob
                        canvas.toBlob(function (blob) {
                            // Crea un objeto File para estandarizar el manejo de imágenes
                            const capturedFile = new File([blob], 'CAPTURA_' + Date.now() + '.jpeg', { type: 'image/jpeg' });

                            // 1. Agrega la imagen al arreglo auxiliar con la propiedad 'file'
                            that._aImageSource.push({
                                pos: sPosition,
                                src: URL.createObjectURL(blob),
                                filename: capturedFile.name,
                                ind: 'n',
                                index: index,
                                file: capturedFile
                            });

                            // 2. Guardar en IndexedDB si offline
                            if (!window.navigator.onLine) {
                                sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], function (indexedDBService) {
                                    let reader = new FileReader();
                                    reader.onloadend = function () {
                                        let base64 = reader.result.split(',')[1];
                                        let sMBLRN = that.sObjMBLRN || "TEMP_" + Date.now();
                                        indexedDBService.saveImage({
                                            MBLRN: sMBLRN,
                                            LINE_ID: sPosition,
                                            IMAGE_NAME: capturedFile.name,
                                            data: base64,
                                            mimeType: capturedFile.type,
                                            pending: true,
                                            timestamp: Date.now(),
                                            index: index  // <-- Agrega el campo index aquí!
                                        });
                                    };
                                    reader.readAsDataURL(capturedFile);
                                });
                            }

                            // 3. Mostrar preview visual si tienes un control para ello
                            if (oPreview) {
                                oPreview.setSrc(URL.createObjectURL(blob));
                                oPreview.setVisible(true);
                            }

                            sap.m.MessageToast.show("Foto capturada correctamente.");

                            // Detén la cámara para liberar recursos
                            if (video.srcObject) {
                                video.srcObject.getTracks().forEach(t => t.stop());
                            }

                            oCamDialog.close();
                            oCamDialog.destroy();

                        }, 'image/jpeg', 0.9);
                    };
                }
            });

            this.getView().addDependent(oCamDialog);
            oCamDialog.open();
        },

        getIndexByPos: function (sPosition) {
            var aData = this._aImageSource.filter(oItem => oItem.pos === sPosition);
            return this.getMaxIndexImage(aData);
        },

        getMaxIndexImage: function (aData) {
            var iIndex = 0;
            if (!aData || aData.length === 0) {
                return iIndex; // No hay imágenes
            }

            var oLine = aData.reduce(function (maxObj, current) {
                return current.index > maxObj.index ? current : maxObj;
            });
            return oLine.index + 1;
        },

        /*
        onSelectPhoto: function () {
            var that = this;
            navigator.camera.getPicture(
                function (oImage) {
                    that._onAddImage(that, oImage);
                },
                this.onFail, {
                quality: 90,
                targetWidth: 300,
                targetHeight: 500,
                sourceType: navigator.camera.PictureSourceType.PHOTOLIBRARY,
                destinationType: navigator.camera.DestinationType.FILE_URI,
                encodingType: navigator.camera.EncodingType.JPEG,
                mediaType: navigator.camera.MediaType.PICTURE
            });
        },
        */

        onSelectPhoto: function () {
            var that = this;
            var sFragmentId = this.createId("myDialog");
            var oDialog = sap.ui.core.Fragment.byId(sFragmentId, "myDialog");
            var sTitle = oDialog.getTitle();
            var sTitlePos = oBuni18n.getText("titlePos") + " ";
            var sPosition = sTitle.split(sTitlePos)[1];
            var iIndex = this.getIndexByPos(sPosition);

            navigator.camera.getPicture(
                function (imageURI) {
                    window.resolveLocalFileSystemURL(imageURI, function (fileEntry) {
                        // Guarda solo el fileEntry, no el file directamente
                        that._aImageSource.push({
                            pos: sPosition,
                            src: imageURI,
                            fileEntry: fileEntry,
                            filename: fileEntry.name,
                            ind: "n", // nueva imagen
                            index: iIndex,
                            source: "gallery"
                        });

                        sap.m.MessageToast.show("Imagen agregada: " + fileEntry.name);
                    }, function (err) {
                        console.error("Error al resolver la URI:", err);
                    });
                },
                function (error) {
                    console.error("Error al seleccionar la imagen:", error);
                },
                {
                    quality: 70,
                    destinationType: Camera.DestinationType.FILE_URI,
                    sourceType: Camera.PictureSourceType.PHOTOLIBRARY, // <-- galería
                    encodingType: Camera.EncodingType.JPEG,
                    mediaType: Camera.MediaType.PICTURE,
                    correctOrientation: true
                }
            );
        },


        _onAddImage: function (that, oImage) {
            var oItem = {
                imageID: "",
                alt: "",
                src: oImage
            }
            that._aImageSource.push(oItem);

            var i18 = that.getOwnerComponent().getModel("i18n").getResourceBundle();
            sap.m.MessageToast.show(i18.getText("SUCCESSPHOTO"));
        },

        onFail: function (message) {
            alert("Failed because: " + message);
        },

        onSeePhoto: function () {
            // Verificar si está en modo offline
            if (!window.navigator.onLine) {
                var i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                sap.m.MessageToast.show(i18.getText("SEEPHOTO") + " - Función solo disponible en modo online");
                return;
            }

            var that = this;
            var sFragmentId = this.createId("myDialog");
            var oDialog = sap.ui.core.Fragment.byId(sFragmentId, "myDialog");
            var sTitle = oDialog.getTitle();
            var sTitlePos = oBuni18n.getText("titlePos") + " ";
            var sPosition = sTitle.split(sTitlePos)[1];
            var oCarousel = this.getCarousel();
            var oModel = this.getCarouselModel(sPosition);
            var aData = oModel.getData();
            var bDelVisible = true;
            var oGlobalModel = this.getView().getModel("globalModel");
            var bEnabled = oGlobalModel.getProperty("/enabled_d");
            if (aData.length == 0) {
                bDelVisible = false;
            }
            //if (!this.oPicDialog) {
            var i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            var sTitle = oBuni18n.getText("SEEPHOTO");
            this.oPicDialog = new sap.m.Dialog({
                title: sTitle,
                verticalScrolling: false,
                stretch: true,
                content: [
                    oCarousel
                ],
                beginButton: new sap.m.Button({
                    text: i18.getText("DELETEPHOTO"),
                    type: "Reject",
                    visible: bDelVisible,
                    enabled: bEnabled,
                    press: function (oEvent) {
                        this.onDeletePic(oEvent);
                        this.oPicDialog.close();
                    }.bind(this)
                }),
                endButton: new sap.m.Button({
                    text: i18.getText("closeBtn"),
                    press: function () {
                        this.oPicDialog.close();
                    }.bind(this)
                })
            });
            //}


            this.oPicDialog.getContent()[0].setModel(oModel);
            this.oPicDialog.open();
        },

        getCarousel: function () {
            var oCarousel = new sap.m.Carousel({
                loop: true,
                pages: {
                    path: "/",
                    template: new sap.m.Image({
                        src: "{src}",
                        alt: "{filename}",
                    })
                }
            }).addStyleClass("sapUiContentPadding");
            return oCarousel;
        },

        getCarouselModel: function (sPosition) {

            /*
            var aData = [
                { pos: "0010", filename: "Sowmya", src: "https://letsenhance.io/static/73136da51c245e80edc6ccfe44888a99/1015f/MainBefore.jpg" },
                { pos: "0020", filename: "Gayathri", src: "https://images.unsplash.com/photo-1575936123452-b67c3203c357?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aW1hZ2V8ZW58MHx8MHx8fDA%3D" },
                { pos: "0030", filename: "Gowrav", src: "https://cdn.pixabay.com/photo/2015/04/23/22/00/new-year-background-736885_1280.jpg" }
            ];
            aData = aData.filter(oItem => oItem.pos === sPosition);
            */

            var aData = this._aImageSource.filter(oItem => oItem.pos === sPosition);
            var oModel = new sap.ui.model.json.JSONModel(aData);
            return oModel;
        },

        //Sign
        onSign: function () {
            var that = this;
            var i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            // Crear el contenido del canvas dentro del Dialog
            var oNextId = this._getNextId();
            var sIdentifier = this._getIDIdentifier(oNextId.toString());
            //var sCount = "(" + oNextId + "/" + this._signAuth.length + ")";
            var dialog = new sap.m.Dialog({
                title: i18.getText("Sign") + " - " + sIdentifier,
                content: new sap.ui.core.HTML({
                    content: "<canvas id='signature-pad' width='400' height='200' style='border: 1px solid #ccc;'></canvas>"
                }),
                buttons: [
                    new sap.m.Button({
                        text: i18.getText("SaveSign"),
                        press: function () {
                            var sId = that._getNextId();
                            if (sId) {
                                if (that.sObjMBLRN) {
                                    var canvas = document.getElementById('signature-pad');
                                    var context = canvas.getContext('2d');

                                    // Guardamos el contenido actual del canvas (la firma)
                                    var signatureDataURL = canvas.toDataURL('image/jpeg');

                                    // Asegurarse de que el fondo sea blanco antes de convertir a imagen
                                    context.fillStyle = "#ffffff";
                                    context.fillRect(0, 0, canvas.width, canvas.height); // Aseguramos que el fondo sea blanco

                                    // Restaurar la firma sobre el fondo blanco
                                    var img = new Image();
                                    img.src = signatureDataURL;
                                    img.onload = function () {
                                        // Dibujar la firma restaurada sobre el canvas
                                        context.drawImage(img, 0, 0);

                                        // Ahora convertir a una imagen final para descargar
                                        var finalDataURL = canvas.toDataURL('image/jpeg');

                                        // Enviar la firma a la API
                                        that.processSignature(finalDataURL).then(function (blob) {
                                            // Subir la firma a la API
                                            that.uploadSignature(blob, dialog);
                                        }).catch(function (error) {
                                            console.error("Error al procesar la firma:", error);
                                        });
                                    };
                                } else {
                                    sap.m.MessageToast.show(i18.getText("noSingAvailableMBLRN"));
                                }
                            } else {
                                sap.m.MessageToast.show(i18.getText("noSingAvailable"));
                            }
                        }
                    }),
                    new sap.m.Button({
                        text: i18.getText("CleanSign"),
                        press: function () {
                            var canvas = document.getElementById('signature-pad');
                            var context = canvas.getContext('2d');
                            context.clearRect(0, 0, canvas.width, canvas.height); // Limpiar el canvas
                        }
                    }),
                    new sap.m.Button({
                        text: i18.getText("closeBtn"),
                        press: function () {
                            dialog.close();
                        }
                    })
                ]
            });

            // Abrir el diálogo
            dialog.open();

            // Inicializar el canvas y los eventos para la firma
            this._initializeCanvas();
        },

        // Inicializar el canvas y los eventos de firma
        _initializeCanvas: function () {
            var canvas = document.getElementById('signature-pad');
            var context = canvas.getContext('2d');

            // Establecer las propiedades iniciales del canvas
            context.fillStyle = "#ffffff"; // Fondo blanco
            context.fillRect(0, 0, canvas.width, canvas.height); // Rellenar el fondo con blanco
            context.strokeStyle = "#000000"; // Color del trazo (negro)
            context.lineWidth = 2; // Grosor del trazo
            context.lineCap = "round"; // Líneas redondeadas

            // Variables para controlar el estado del dibujo
            var drawing = false;
            var lastX = 0;
            var lastY = 0;

            // Función para obtener las coordenadas del mouse/touch
            function getCoords(e) {
                var x, y;
                if (e.changedTouches && e.changedTouches[0]) {
                    var offsetX = canvas.offsetLeft;
                    var offsetY = canvas.offsetTop;
                    x = e.changedTouches[0].pageX - offsetX;
                    y = e.changedTouches[0].pageY - offsetY;
                } else {
                    x = e.offsetX || e.layerX;
                    y = e.offsetY || e.layerY;
                }
                return { x: x, y: y };
            }

            // Función para comenzar a dibujar (mousedown/touchstart)
            function startDrawing(e) {
                e.preventDefault();
                e.stopPropagation();
                var coords = getCoords(e);
                lastX = coords.x;
                lastY = coords.y;
                drawing = true;
            }

            // Función para dibujar en el canvas (mousemove/touchmove)
            function draw(e) {
                if (!drawing) return;
                e.preventDefault();
                e.stopPropagation();
                var coords = getCoords(e);
                context.beginPath();
                context.moveTo(lastX, lastY);
                context.lineTo(coords.x, coords.y);
                context.stroke();
                lastX = coords.x;
                lastY = coords.y;
            }

            // Función para detener el dibujo (mouseup/touchend)
            function stopDrawing() {
                drawing = false;
            }

            // Agregar los event listeners para el canvas
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('touchstart', startDrawing);
            canvas.addEventListener('touchmove', draw);
            canvas.addEventListener('touchend', stopDrawing);
        },

        processSignature: function (finalUrl, format = 'image/jpeg') {
            return new Promise((resolve, reject) => {
                try {
                    // Obtener la imagen de la firma (en Base64)
                    var signatureDataURL = finalUrl;

                    // Convertir la imagen Base64 a Blob
                    var byteString = atob(signatureDataURL.split(',')[1]);  // Eliminar el encabezado base64
                    var mimeString = signatureDataURL.split(',')[0].split(':')[1].split(';')[0];  // Tipo MIME
                    var ab = new ArrayBuffer(byteString.length);
                    var ia = new Uint8Array(ab);

                    // Llenar el array de bytes
                    for (var i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }

                    // Crear el Blob con la firma procesada
                    var blob = new Blob([ab], { type: mimeString });

                    // Resolver la promesa con el Blob de la firma
                    resolve(blob);

                } catch (error) {
                    reject(error);
                }
            });
        },

        // Subir la firma a la API
        /*
        uploadSignature: function (blob, dialog) {
            var that = this;
            var formData = new FormData();
            const metadataArray = [];

            // Añadir el Blob de la firma al FormData
            formData.append("image", blob, "signature.jpeg");

            // Puedes agregar más parámetros en metadataArray si lo necesitas
            metadataArray.push({
                DOCID: that.sObjMBLRN,
                ID: that._getNextId(),
                PROCESS: sProcess,
                SUBPROCESS: sSubProcess
            });

            formData.append("metadata", JSON.stringify(metadataArray));

            // Enviar la firma a la API
            $.ajax({
                url: host + "/ImageSignItem",  // Cambia esta URL por la de tu API
                type: "POST",
                data: formData,
                async: true,
                processData: false,
                contentType: false,
                success: function (response) {
                    dialog.close();
                    console.log("Firma guardada correctamente");
                    sap.m.MessageToast.show("Firma guardada con éxito.");
                    that._checkNumberOfSigns(true);
                },
                error: function (xhr, status, error) {
                    console.error("Error al guardar la firma:", status, error);
                    sap.m.MessageToast.show("Error al guardar la firma.");
                }
            });
        },
        */
        // Offline
        uploadSignature: function (blob, dialog) {
            var that = this;
            var formData = new FormData();
            const metadataArray = [];

            metadataArray.push({
                DOCID: that.sObjMBLRN,
                ID: that._getNextId(),
                PROCESS: sProcess,
                SUBPROCESS: sSubProcess
            });

            // --- NUEVO: Soporte OFFLINE ---
            if (!window.navigator.onLine) {
                sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], function (indexedDBService) {
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        var base64 = e.target.result.split(',')[1];
                        var signatureObj = {
                            DOCID: that.sObjMBLRN,
                            ID: that._getNextId(),
                            PROCESS: sProcess,
                            SUBPROCESS: sSubProcess,
                            EMAIL: sEmail,
                            USER: sUserName,
                            AREA: "", // Puedes completar esto si tienes el área/nivel
                            image: base64,
                            mimeType: "image/jpeg",
                            timestamp: Date.now(),
                            opType: "create",
                            pending: true,
                            synced: false
                        };
                        // Guarda la firma
                        indexedDBService.saveSignature(signatureObj);
                        // Agrega a pendientes para sincronizar luego
                        indexedDBService.addPendingOp({
                            id: signatureObj.DOCID + "_" + signatureObj.ID + "_" + signatureObj.EMAIL,
                            type: "Signature",
                            data: signatureObj,
                            timestamp: signatureObj.timestamp,
                            opType: "create"
                        });
                        sap.m.MessageToast.show("Firma guardada offline. Se sincronizará al volver online.");
                        dialog.close();
                    };
                    reader.readAsDataURL(blob);
                });
                return;
            }
            // --- FIN NUEVO ---

            // Lógica ONLINE (sin cambios)
            formData.append("image", blob, "signature.jpeg");
            formData.append("metadata", JSON.stringify(metadataArray));

            $.ajax({
                url: host + "/ImageSignItem",
                type: "POST",
                data: formData,
                async: true,
                processData: false,
                contentType: false,
                success: function (response) {
                    dialog.close();
                    sap.m.MessageToast.show("Firma guardada con éxito.");
                    that._checkNumberOfSigns(true);
                },
                error: function (xhr, status, error) {
                    console.error("Error al guardar la firma:", status, error);
                    sap.m.MessageToast.show("Error al guardar la firma.");
                }
            });
        },
        /*
        onShowSignBtn: function () {
            var oCarousel = this.getSingCarousel();
            var oModel = this.getSignCarouselModel();
            var aData = oModel.getData();
            var bDelVisible = true;
            var oGlobalModel = this.getView().getModel("globalModel");
            var bEnabled = oGlobalModel.getProperty("/enabled_d");
            if (aData.length == 0) {
                bDelVisible = false;
            }
            var i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            var sTitle = oBuni18n.getText("ShowSing");
            this.oSignDialog = new sap.m.Dialog({
                title: sTitle,
                content: [
                    oCarousel
                ],
                beginButton: new sap.m.Button({
                    text: i18.getText("DeleteSign"),
                    type: "Reject",
                    visible: bDelVisible,
                    enabled: true,
                    press: function (oEvent) {
                        this.onDeleteSign(oEvent, this.oSignDialog);
                    }.bind(this)
                }),
                endButton: new sap.m.Button({
                    text: i18.getText("closeBtn"),
                    press: function () {
                        this.oSignDialog.close();
                    }.bind(this)
                })
            });

            this.oSignDialog.getContent()[0].setModel(oModel);
            this.oSignDialog.open();
        },
        */
        // Offline
        
        onShowSignBtn: function () {
            var oCarousel = this.getSingCarousel();
            var oModelOrPromise = this.getSignCarouselModel();
            var that = this;
        
            // Si es una promesa (offline), espera a que resuelva y luego abre el diálogo
            if (oModelOrPromise instanceof Promise || (oModelOrPromise && typeof oModelOrPromise.then === "function")) {
                oModelOrPromise.then(function (oModel) {
                    that._openSignDialogForModel(oCarousel, oModel);
                });
            } else {
                // Modo online: modelo directo
                that._openSignDialogForModel(oCarousel, oModelOrPromise);
            }
        },
        
        // Nueva función auxiliar para abrir el diálogo con el modelo de firmas
        _openSignDialogForModel: function (oCarousel, oModel) {
            var aData = oModel.getData();
            var bDelVisible = aData.length > 0;
            var oGlobalModel = this.getView().getModel("globalModel");
            var bEnabled = oGlobalModel.getProperty("/enabled_d");
            var i18 = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            var sTitle = oBuni18n.getText("ShowSing");
            this.oSignDialog = new sap.m.Dialog({
                title: sTitle,
                content: [
                    oCarousel
                ],
                beginButton: new sap.m.Button({
                    text: i18.getText("DeleteSign"),
                    type: "Reject",
                    visible: bDelVisible,
                    enabled: true,
                    press: function (oEvent) {
                        this.onDeleteSign(oEvent, this.oSignDialog);
                    }.bind(this)
                }),
                endButton: new sap.m.Button({
                    text: i18.getText("closeBtn"),
                    press: function () {
                        this.oSignDialog.close();
                    }.bind(this)
                })
            });
        
            this.oSignDialog.getContent()[0].setModel(oModel);
            this.oSignDialog.open();
        },
        
        checkSignConfiguration: function () {
            this._signImages = [], this._signAuth = [], this._aApproveLevels = [], this._aUserAuth = [];
            this.loadSignParams();
            var bSign = this.checkSignAuth();
            this.bSignAuth = bSign;
            if (bSign) {
                this._checkNumberOfSigns(false);
            }
            this.byId("idBtnShowSign").setVisible(bSign);
            this.byId("idBtnSign").setVisible(bSign);
        },

        loadSignParams: function () {
            var sUrl = `${host}/Sign?$filter=PROCESS EQ '${sApprID}'`;
            var aResponse = this.getDataRangesSynchronously(sUrl);
            var bReturn = false;
            if (aResponse.error) { } else {
                if (aResponse.result) {
                    if (aResponse.result.length > 0) {
                        // Retrieve the current language
                        var sLanguage = Localization.getLanguage();
                        var bSpanish = sLanguage.includes("es");
                        for (var i = 0; i < aResponse.result.length; i++) {
                            var oItem = {
                                ID: aResponse.result[i].ID,
                                DESCRIPTION: bSpanish ? aResponse.result[i].DESCRIPTION : aResponse.result[i].DESCRIPTION_EN,
                                PROCESS: aResponse.result[i].PROCESS
                            };
                            this._signAuth.push(oItem);
                        }
                    }
                }
            }
        },

        checkSignAuth: function () {
            //sEmail = "david.venegas@celeritech.biz"
            //sEmail = "ariel.piedra@celeritech.biz"
            var sUrl = `${host}/Rol?$filter=ID EQ ${sAppID} AND TYPE EQ 2 AND EMAIL EQ '${sEmail}'`;
            var aResponse = this.getDataRangesSynchronously(sUrl);
            var bReturn = false;
            if (aResponse.error) { } else {
                if (aResponse.result) {
                    if (aResponse.result.length > 0) {
                        this._aApproveLevels = aResponse.result;
                        bReturn = true;
                    }
                }
            }
            return bReturn;
        },

        _checkNumberOfSigns: function (bCheck) {
            var sUrl = `${host}/Rol?$filter=ID EQ ${sAppID} AND TYPE EQ 2`;
            var aResponse = this.getDataRangesSynchronously(sUrl);
            if (aResponse.error) { } else {
                if (aResponse.result) {
                    if (aResponse.result.length > 0) {
                        this._aUserAuth = aResponse.result;
                        this._getSigns(this._aUserAuth, this._aUserAuth.length, bCheck);
                        this.enableFieldsBySign();
                    }
                }
            }
        },

        _getSigns: function (aUsers, iNumApprovers, bCheck) {
            var aReturn = [];
            //let url = host + "/ImageSignItem/" + this.sObjMBLRN + "/" + sProcess + "/" + sSubProcess;
            let url = host + "/ImageSignItem/" + this.sObjMBLRN;
            var aResponse = this.getDataRangesSynchronously(url);
            if (aResponse) {
                if (aResponse.images) {
                    if (aResponse.images.length > 0) {
                        aReturn = aResponse.images;
                    }
                }
            }
            var aImages = [];
            for (var i = 0; i < aReturn.length; i++) {
                var imageSrc = "data:image/jpeg;base64," + aReturn[i].data;
                var sId = aReturn[i].ID.toString();
                var oObj = aUsers.filter(oItem => oItem.NUMAPR === sId);
                var sMail = "";
                if (oObj) {
                    if (oObj.length > 0) {
                        sMail = oObj[0].EMAIL;
                    }
                }
                aImages.push({
                    DOCID: aReturn[i].DOCID,
                    src: imageSrc, // prefijo incluido
                    ID: aReturn[i].ID,
                    PROCESS: aReturn[i].PROCESS,
                    SUBPROCESS: aReturn[i].SUBPROCESS,
                    USER: sMail,
                    AREA: this._getIDIdentifier(aReturn[i].ID.toString())
                });
            }

            this._signImages = aImages;
            var bCheckSign = false;
            for (var i = 0; i < aUsers.length; i++) {
                var sNumApr = aUsers[i].NUMAPR;
                bCheckSign = this._getCheckSign(sNumApr, aReturn);
                if (!bCheckSign) {
                    break;
                }
            }
            if (bCheck) {
                if (bCheckSign) {
                    if (iNumApprovers === aReturn.length) {
                        this.updateMARAStatus();
                        //this.updateMaterialStatus();
                    }
                }
            }
        },

        updateMARAStatus: function () {
            const oModel = this.getView().getModel("serviceModel");
            aJsonCreate = oModel.getProperty("/ScheduleLine");
            var oViewObj = this.oReceptMaterialsHeader;
            var aItems = this._getLinesTableStatus(aJsonCreate, oViewObj.MBLRN);
            let conditions = [];
            function addCondition(field, values) {
                if (values && values.length > 0) {
                    let condition = values.map(value => `${field} EQ '${value}'`).join(" OR ");
                    conditions.push(`${condition}`); // Agrupa con paréntesis
                }
            }
            var aMATNR = [];
            aItems.forEach(function (oItem) {
                aMATNR.push(oItem.MATNR);
            });
            addCondition("MATNR", aMATNR);
            var aMaterialData = [];
            if (conditions.length > 0) {
                var sFilter = "/Material?$filter=" + conditions[0];
                var sUrl = `${host}` + sFilter;
                var aResult = this.getDataRangesSynchronously(sUrl);
                if (aResult.result) {
                    aMaterialData = aResult.result;
                }
            }

            if (aMaterialData.length > 0) {
                aMaterialData = aMaterialData.filter(oItem => !(oItem.MATNR_SAP)); //Remove where MATNR_SAP !== null
                var aMaterial = [];
                for (var i = 0; i < aMaterialData.length; i++) {
                    aMaterial.push({
                        MATNR: aMaterialData[i].MATNR,
                        STATUS: "3"
                    });
                }
                if (aMaterial.length > 0) {
                    var sReturn = this._updateAPIData(aMaterial, "/Material/");
                    var sMsg = "";
                    if (sReturn) {
                        sMsg = oBuni18n.getText("ERROR_STATUS");
                        MessageBox.error(sMsg + ": " + sReturn);
                    } else {
                        sMsg = oBuni18n.getText("EXITO_STATUS");
                        MessageBox.success(sMsg);
                    }
                }
            }
        },

        enableFieldsBySign: function () {
            if (this.bSignAuth) {
                var iNumSigns = 0;
                if (this._signImages) {
                    iNumSigns = this._signImages.length;
                }
                var iNumApprovers = 0;
                if (this._aUserAuth) {
                    iNumApprovers = this._aUserAuth.length;
                }

                var bEnabled = true;
                if (iNumApprovers === iNumSigns) {
                    bEnabled = false;
                    this._setEditEnabledLabels(bEnabled);
                }
                this.byId("idBtnEdit").setVisible(bEnabled);
                this.byId("idBtnSign").setVisible(bEnabled);
            }
        },

        updateMaterialStatus: async function () {
            var that = this;
            var oViewObj = this.oReceptMaterialsHeader;
            //var oPayload = this._getPayloadUpdate(oViewObj);
            var oPayload = this._getPayloadUpdateStatus(oViewObj);
            var url = `${host}/MaterialDocument/${oViewObj.MBLRN}`;
            for (var i = 0; i < oPayload.Items.length; i++) {
                oPayload.Items[i]['STATUS'] = '3';
            }
            let response = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oPayload)
            });
            let responseData = await response.json();
            if (!response.ok) {
                sap.ui.core.BusyIndicator.hide();
                var sMsg = "";
                if (responseData.mensaje) {
                    sMsg = responseData.mensaje;
                }
                if (responseData.error) {
                    sMsg = responseData.error;
                }
                MessageBox.error(sMsg);
                return responseData;
            }
            if (response.status === 200) {
                var sMsg = oBuni18n.getText("successSigns");
                MessageBox.success(sMsg);
            }
            return responseData;
        },

        _getCheckSign: function (sNumApr, aReturn) {
            var bReturn = false;
            for (var j = 0; j < aReturn.length; j++) {
                var sID = aReturn[j].ID.toString();
                if (sID === sNumApr) {
                    bReturn = true;
                    break;
                }
            }
            return bReturn;
        },

        getSingCarousel: function () {
            var oCarousel = new sap.m.Carousel({
                loop: true,
                pages: {
                    path: "/",
                    template: new sap.m.FlexBox({
                        alignItems: "Center",
                        justifyContent: "Center",
                        items: [
                            new sap.ui.layout.VerticalLayout({
                                content: [
                                    new sap.m.Image({
                                        src: "{src}",
                                        alt: "{filename}",
                                    }),
                                    new sap.m.Title({
                                        level: "H3",
                                        text: "{AREA}"
                                    }),
                                    new sap.m.Text({
                                        text: "{USER}"
                                    })]
                            }).addStyleClass("sapUiContentPadding")
                        ]
                    })
                }
            })
            return oCarousel;
        },
        /*
        onDeleteSign: function (oEvent, oDialog) {
            var that = this;
            var oActivePage = oEvent.getSource().getParent().getContent()[0].getActivePage();
            var oLineSelected = sap.ui.getCore().byId(oActivePage).getBindingContext().getObject();
            if (oLineSelected.USER === sEmail) {
                var oItem = {
                    DOCID: oLineSelected.DOCID.toString(),
                    ID: oLineSelected.ID.toString(),
                    PROCESS: oLineSelected.PROCESS,
                    SUBPROCESS: oLineSelected.SUBPROCESS
                };
                $.ajax({
                    url: host + "/ImageSignItem",
                    method: "DELETE",
                    contentType: "application/json",
                    data: JSON.stringify([oItem]),
                    success: function (response) {
                        oDialog.close();
                        oEvent.getSource().getParent().close();
                        sap.m.MessageToast.show(response.result);
                        that._checkNumberOfSigns(false);
                    }.bind(this),
                    error: function (xhr, status, error) {
                        sap.m.MessageToast.show(xhr.responseText);
                    }
                });
            } else {
                sap.m.MessageToast.show(oBuni18n.getText("noDeleteAva"));
            }
        },
        */
        // Offline
        onDeleteSign: function (oEvent, oDialog) {
            var that = this;
            var oActivePage = oEvent.getSource().getParent().getContent()[0].getActivePage();
            var oLineSelected = sap.ui.getCore().byId(oActivePage).getBindingContext().getObject();

            if (oLineSelected.USER === sEmail) {
                var oItem = {
                    DOCID: oLineSelected.DOCID.toString(),
                    ID: oLineSelected.ID.toString(),
                    PROCESS: oLineSelected.PROCESS,
                    SUBPROCESS: oLineSelected.SUBPROCESS
                };

                // --- NUEVO: Soporte OFFLINE ---
                if (!window.navigator.onLine) {
                    sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], function (indexedDBService) {
                        // El id de la firma debe coincidir con el formato guardado
                        var signatureId = oItem.DOCID + "_" + oItem.ID + "_" + sEmail;
                        // 1. Borra la firma local
                        indexedDBService.deleteSignature(signatureId);
                        // 2. Registra la eliminación como operación pendiente
                        indexedDBService.addPendingOp({
                            id: signatureId + "_del",
                            type: "Signature",
                            data: oItem,
                            timestamp: Date.now(),
                            opType: "delete"
                        });
                        sap.m.MessageToast.show("Firma eliminada offline. Se sincronizará al volver online.");
                        oDialog.close();
                        that._checkNumberOfSigns(false);
                    });
                    return;
                }
                // --- FIN NUEVO ---

                // ONLINE (sin cambios)
                $.ajax({
                    url: host + "/ImageSignItem",
                    method: "DELETE",
                    contentType: "application/json",
                    data: JSON.stringify([oItem]),
                    success: function (response) {
                        oDialog.close();
                        oEvent.getSource().getParent().close();
                        sap.m.MessageToast.show(response.result);
                        that._checkNumberOfSigns(false);
                    }.bind(this),
                    error: function (xhr, status, error) {
                        sap.m.MessageToast.show(xhr.responseText);
                    }
                });
            } else {
                sap.m.MessageToast.show(oBuni18n.getText("noDeleteAva"));
            }
        },
        /*
        getSignCarouselModel: function (sPosition) {
            this._signImages.sort((a, b) => a.ID - b.ID);
            var oModel = new sap.ui.model.json.JSONModel(this._signImages);
            return oModel;
        },
        */
        // Offline
        getSignCarouselModel: function () {
            var that = this;
            if (!window.navigator.onLine) {
                // --- MODO OFFLINE ---
                var oDeferred = $.Deferred();
                sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], function (indexedDBService) {
                    indexedDBService.getAllSignatures().then(function (aSigns) {
                        // Filtra por el documento actual
                        var offlineSigns = aSigns.filter(function (sign) {
                            return sign.DOCID === that.sObjMBLRN;
                        }).map(function (sign) {
                            return {
                                DOCID: sign.DOCID,
                                src: "data:" + (sign.mimeType || "image/jpeg") + ";base64," + sign.image,
                                ID: sign.ID,
                                PROCESS: sign.PROCESS,
                                SUBPROCESS: sign.SUBPROCESS,
                                USER: sign.EMAIL,
                                AREA: that._getIDIdentifier(sign.ID ? sign.ID.toString() : "")
                            };
                        });
                        // Ordena igual que online
                        offlineSigns.sort(function (a, b) { return a.ID - b.ID; });
                        var oModel = new sap.ui.model.json.JSONModel(offlineSigns);
                        oDeferred.resolve(oModel);
                    });
                });
                return oDeferred.promise();
            } else {
                // --- MODO ONLINE (original) ---
                this._signImages.sort((a, b) => a.ID - b.ID);
                var oModel = new sap.ui.model.json.JSONModel(this._signImages);
                return oModel;
            }
        },

        _getNextId: function () {
            var aLevels = this._aApproveLevels.sort((a, b) => a.NUMAPR - b.NUMAPR);
            var aFirmas = this._signImages.filter(oItem => oItem.USER === sEmail);
            var aFirmas = aFirmas.sort((a, b) => a.ID - b.ID);
            var sNextId = "";
            if (aFirmas.length === 0) {
                sNextId = aLevels[0].NUMAPR;
            } else {
                var aAvailable = [];
                for (var i = 0; i < aLevels.length; i++) {
                    var iNUMAPR = parseInt(aLevels[i].NUMAPR);
                    var aItem = aFirmas.filter(oItem => oItem.ID === iNUMAPR);
                    if (aItem.length === 0) {
                        aAvailable.push(aLevels[i].NUMAPR);
                    }
                }
                if (aAvailable.length > 0) {
                    sNextId = aAvailable[0];
                }
            }
            return sNextId;
        },

        _getIDIdentifier: function (sID) {
            var oObj = this._signAuth.filter(oItem => oItem.ID === sID);
            if (oObj.length > 0) {
                return (oObj[0].DESCRIPTION) ? oObj[0].DESCRIPTION : "";
            } else {
                return "";
            }
        },
        // Ya finciona de manra online
        /*
        onFileUploaderChange: function (oEvent) {
            var files = oEvent.getParameter("files");
            var sFragmentId = this.createId("myDialog");
            var oDialog = sap.ui.core.Fragment.byId(sFragmentId, "myDialog");
            var oPreview = sap.ui.core.Fragment.byId(sFragmentId, "idPhotoPreview"); // <-- preview
            var sTitle = oDialog.getTitle();
            var sTitlePos = oBuni18n.getText("titlePos") + " ";
            var sPosition = sTitle.split(sTitlePos)[1];
            var index = this.getIndexByPos(sPosition);

            if (files && files.length > 0) {
                var file = files[0];
                var reader = new FileReader();
                reader.onload = function (e) {
                    var base64 = e.target.result;

                    this._aImageSource.push({
                        pos: sPosition,
                        src: base64,
                        file: file,  // <-- agrega el objeto File aquí
                        filename: file.name,
                        ind: 'n',
                        index: index
                    });

                    // MOSTRAR PREVIEW
                    if (oPreview) {
                        oPreview.setSrc(base64);
                        oPreview.setVisible(true);
                    }

                    sap.m.MessageToast.show("Imagen agregada correctamente.");
                }.bind(this);
                reader.readAsDataURL(file);
            }
        },

        /**
         * Extrae y muestra el nombre del usuario desde el ERNAM híbrido en el modelo global
         * @param {string} sHybridERNAM - ERNAM con formato "8charsUUID_NOMBRE_APELLIDO"
         */
        _showBlockedMessageFromHybridERNAMGlobal: function (sHybridERNAM) {
            const oGlobalModel = this.getView().getModel("globalModel");
            const oBuni18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            
            if (!sHybridERNAM || !sHybridERNAM.trim()) {
                oGlobalModel.setProperty("/messageStripText", oBuni18n.getText("I_F_Blocked_Generic") || "Documento bloqueado por otro usuario");
                return;
            }

            // Extraer nombre del ERNAM híbrido
            const displayName = this._extractDisplayNameFromHybridERNAM(sHybridERNAM);
            
            if (displayName) {
                console.log("✅ Mostrando nombre extraído del ERNAM en modelo global:", displayName);
                oGlobalModel.setProperty("/messageStripText", (oBuni18n.getText("I_F_Blocked") || "Documento bloqueado por {0}").replace("{0}", displayName));
            } else {
                console.log("⚠️ No se pudo extraer nombre, mostrando ERNAM completo en modelo global:", sHybridERNAM);
                oGlobalModel.setProperty("/messageStripText", (oBuni18n.getText("I_F_Blocked") || "Documento bloqueado por {0}").replace("{0}", sHybridERNAM));
            }
        },

        /**
         * Extrae el nombre del usuario desde el ERNAM híbrido
         * @param {string} sHybridERNAM - ERNAM con formato "8charsUUID_NOMBRE_APELLIDO"
         * @returns {string|null} Nombre del usuario o null si no se puede extraer
         */
        _extractDisplayNameFromHybridERNAM: function (sHybridERNAM) {
            try {
                // Buscar el guión bajo que separa el ID del nombre
                const underscoreIndex = sHybridERNAM.indexOf('_');
                
                if (underscoreIndex === -1) {
                    // No hay guión bajo, es solo el ID
                    console.log("⚠️ ERNAM no tiene formato híbrido:", sHybridERNAM);
                    return null;
                }
                
                // Extraer la parte después del guión bajo (nombre y apellido)
                const displayName = sHybridERNAM.substring(underscoreIndex + 1);
                
                if (displayName && displayName.trim()) {
                    return displayName.trim();
                } else {
                    console.log("⚠️ Nombre extraído está vacío:", displayName);
                    return null;
                }
                
            } catch (e) {
                console.error("❌ Error extrayendo nombre del ERNAM:", e);
                return null;
            }
        },

        onExit: async function () {
            // Session Management - Clean up intervals when controller is destroyed
            if (this._sessionInterval) {
                clearInterval(this._sessionInterval);
                this._sessionInterval = null;
            }

            // Liberar sesión activa si existe (solo en modo online)
            if (window.navigator.onLine && sObjectId && sObjectId !== "New") {
                try {
                    console.log("🧹 Limpiando sesión al salir del controlador:", sObjectId);
                    const deleteResult = await Services.DeleteUserSessions();
                    if (deleteResult && deleteResult !== "Error") {
                        console.log("✅ Sesión liberada exitosamente al salir");
                    } else {
                        console.warn("⚠️ Advertencia al liberar sesión al salir:", deleteResult);
                    }
                } catch (e) {
                    console.error("❌ Error liberando sesión al salir:", e);
                }
            }
        },

        // Offline
        onFileUploaderChange: function (oEvent) {
            var files = oEvent.getParameter("files");
            var sFragmentId = this.createId("myDialog");
            var oDialog = sap.ui.core.Fragment.byId(sFragmentId, "myDialog");
            var oPreview = sap.ui.core.Fragment.byId(sFragmentId, "idPhotoPreview"); // <-- preview
            var sTitle = oDialog.getTitle();
            var sTitlePos = oBuni18n.getText("titlePos") + " ";
            var sPosition = sTitle.split(sTitlePos)[1];
            var index = this.getIndexByPos(sPosition);

            if (files && files.length > 0) {
                var file = files[0];
                var reader = new FileReader();
                reader.onload = function (e) {
                    var base64 = e.target.result;

                    this._aImageSource.push({
                        pos: sPosition,
                        src: base64,
                        file: file,
                        filename: file.name,
                        ind: 'n',
                        index: index
                    });

                    // Guardar en IndexedDB si offline
                    if (!window.navigator.onLine) {
                        sap.ui.require(["com/xcaret/recepcionarticulosoff/model/indexedDBService"], function (indexedDBService) {
                            let sMBLRN = this.sObjMBLRN || "TEMP_" + Date.now();
                            indexedDBService.saveImage({
                                MBLRN: sMBLRN,
                                LINE_ID: sPosition,
                                IMAGE_NAME: file.name,
                                data: base64.split(',')[1],
                                mimeType: file.type,
                                pending: true,
                                timestamp: Date.now(),
                                index: index  // <-- Agrega el campo index aquí!
                            });
                        }.bind(this));
                    }

                    // MOSTRAR PREVIEW
                    if (oPreview) {
                        oPreview.setSrc(base64);
                        oPreview.setVisible(true);
                    }

                    sap.m.MessageToast.show("Imagen agregada correctamente.");
                }.bind(this);
                reader.readAsDataURL(file);
            }
        }
    });
});
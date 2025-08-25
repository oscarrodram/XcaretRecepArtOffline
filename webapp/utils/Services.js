sap.ui.define([
    "com/xcaret/recepcionarticulosoff/utils/Users"
], function (Users) {
    "use strict";

    // Cambia aquí si usas otra tabla de sesión (ej: "MSEG" para tu nuevo proyecto)
    const SESSION_TABLE_NAME = "MSEG";

    return {
        getHost: function() {
            // Verificar si estamos en modo offline
            if (!window.navigator.onLine) {
                return null; // Modo offline
            }
            
            // Set host
            let host = "";
            var sHost = window.location.hostname;
            if (sHost.includes("btpdev")) {
                host = "https://experiencias-xcaret-parques-s-a-p-i-de-c-v--xc-btpdev-15aca4ac6.cfapps.us10-001.hana.ondemand.com";
            } else if (sHost.includes("qas-btp")) {
                host = "https://node.cfapps.us10-001.hana.ondemand.com";
            } else if (sHost.includes("prd-btp")) {
                host = "https://node-api-prd.cfapps.us10-001.hana.ondemand.com";
            } else if (sHost.includes("-workspaces-")) {
                host = "https://experiencias-xcaret-parques-s-a-p-i-de-c-v--xc-btpdev-15aca4ac6.cfapps.us10-001.hana.ondemand.com";
            }
            return host;
        },

        /// ---------- Sessions ---------- ///
        GetSession: async function(controller, sDocumentId){
            // Verificar si estamos en modo offline
            if (!window.navigator.onLine) {
                console.log("📱 Modo offline: No se puede verificar sesión");
                return false;
            }

            let view = controller.getView();
            let host = this.getHost();
            
            if (!host) {
                console.log("❌ No hay host disponible para verificar sesión");
                return false;
            }
            
            try {
                console.log("🔍 GetSession: Verificando sesión para documento:", sDocumentId);
                let response = await fetch(host + `/Session?$filter=TABLE_NAME EQ '${SESSION_TABLE_NAME}' AND INT_ID EQ '${sDocumentId}'`, { method: "GET" });
                if (!response.ok) throw new Error(`${response.error}`);
                let responseData = await response.json();
                console.log("🔍 GetSession: Respuesta del servidor:", responseData);
                
                if(responseData.error) {
                    console.log("❌ GetSession: Error en respuesta:", responseData.error);
                    return false;
                }
                if(!responseData.result || !responseData.result.length) {
                    console.log("❌ GetSession: No hay resultados de sesión");
                    return false;
                }
                
                let oSession = responseData.result[0];
                console.log("🔍 GetSession: Sesión encontrada:", oSession);
                console.log("🔍 GetSession: ERNAM en sesión:", oSession.ERNAM);
                
                let oModel = view.getModel("serviceModel");
                if (oModel) {
                    oModel.setProperty(`/Session`, oSession);
                    console.log("✅ GetSession: Sesión guardada en modelo:", oModel.getProperty("/Session"));
                } else {
                    console.error("❌ GetSession: No se pudo obtener el modelo serviceModel");
                }
                
                return true;
            } catch (error) {
                console.error("❌ GetSession: Error:", error);
                return false;
            }
        },

        PostSession: async function (oController, oBody) {
            // Verificar si estamos en modo offline
            if (!window.navigator.onLine) {
                console.log("📱 Modo offline: No se puede crear sesión");
                return null;
            }

            let host = this.getHost();
            if (!host) {
                console.log("❌ No hay host disponible para crear sesión");
                return null;
            }
            
            // Get Service Info
            try {
                let response = await fetch(host + `/Session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(oBody)
                });
                if (!response.ok) throw new Error(`${await response.text()}`);
                let responseData = await response.json();
                return responseData.result;
            } catch (error) {
                return `Error: ${error.message}`;
            }
        },

        UpdateSession: async function (oController, oBody) {
            // Verificar si estamos en modo offline
            if (!window.navigator.onLine) {
                console.log("📱 Modo offline: No se puede actualizar sesión");
                return null;
            }

            let host = this.getHost();
            if (!host) {
                console.log("❌ No hay host disponible para actualizar sesión");
                return null;
            }
            
            // Get Service Info
            try {
                let response = await fetch(host + `/Session`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(oBody)
                });
                if (!response.ok) throw new Error(`${await response.text()}`);
                let responseData = await response.json();
                return responseData.result;
            } catch (error) {
                return `Error: ${error.message}`;
            }
        },

        DeleteSession: async function (DocumentID) {
            // Verificar si estamos en modo offline
            if (!window.navigator.onLine) {
                console.log("📱 Modo offline: No se puede eliminar sesión");
                return "Offline mode";
            }

            let host = this.getHost();
            if (!host) {
                console.log("❌ No hay host disponible para eliminar sesión");
                return "No host available";
            }
            
            let oUser = Users.getUserInfo();
            let sTable = SESSION_TABLE_NAME;
            
            // Crear el ERNAM híbrido para el borrado (igual que en Json.js)
            const shortUserId = oUser.sUserId ? oUser.sUserId.substring(0, 8) : "";
            const fullName = `${oUser.sFirstName || ""} ${oUser.sLastName || ""}`.trim();
            const hybridERNAM = `${shortUserId}_${fullName}`;
            
            console.log("🔍 DeleteSession: ID completo:", oUser.sUserId);
            console.log("🔍 DeleteSession: ERNAM híbrido para borrado:", hybridERNAM);
            
            // Get Service Info
            try {
                let response = await fetch(host + `/Session/${sTable}/${DocumentID}/${hybridERNAM}`, {
                    method: "DELETE"
                });
                if (!response.ok) throw new Error(`${await response.text()}`);
                console.log("✅ DeleteSession: Sesión eliminada exitosamente con ERNAM:", hybridERNAM);
                return "Erased"
            } catch (error) {
                console.error("❌ DeleteSession: Error eliminando sesión:", error);
                return `Error: ${error.message}`;
            }
        },

        DeleteUserSessions: async function () {
            // Verificar si estamos en modo offline
            if (!window.navigator.onLine) {
                console.log("📱 Modo offline: No se puede eliminar sesiones de usuario");
                return null;
            }

            let host = this.getHost();
            if (!host) {
                console.log("❌ No hay host disponible para eliminar sesiones de usuario");
                return "No host available";
            }
            
            let oUser = Users.getUserInfo();
            let sTable = SESSION_TABLE_NAME;
            
            // Crear el ERNAM híbrido para el borrado (igual que en Json.js)
            const shortUserId = oUser.sUserId ? oUser.sUserId.substring(0, 8) : "";
            const fullName = `${oUser.sFirstName || ""} ${oUser.sLastName || ""}`.trim();
            const hybridERNAM = `${shortUserId}_${fullName}`;
            
            console.log("🔍 DeleteUserSessions: ID completo:", oUser.sUserId);
            console.log("🔍 DeleteUserSessions: ERNAM híbrido para borrado:", hybridERNAM);
            
            try {
                let response = await fetch(host + `/AllUserSession/${sTable}/${hybridERNAM}`, {
                    method: "DELETE"
                });
                if (!response.ok) throw new Error(`${await response.text()}`);
                console.log("✅ DeleteUserSessions: Sesiones del usuario eliminadas exitosamente con ERNAM:", hybridERNAM);
                return "Erased"
            } catch (error) {
                console.error("❌ DeleteUserSessions: Error eliminando sesiones del usuario:", error);
                return `Error: ${error.message}`;
            }
        },

        DeleteAllSessions: async function () {
            // Verificar si estamos en modo offline
            if (!window.navigator.onLine) {
                console.log("📱 Modo offline: No se puede eliminar todas las sesiones");
                return "Offline mode";
            }

            let host = this.getHost();
            if (!host) {
                console.log("❌ No hay host disponible para eliminar todas las sesiones");
                return "No host available";
            }
            
            let datetime = Date.now() - 300000;
            let sTable = SESSION_TABLE_NAME;
            // Get Service Info
            try {
                let response = await fetch(host + `/AllSession/${sTable}/${datetime}`, {
                    method: "DELETE"
                });
                if (!response.ok) throw new Error(`${await response.text()}`);
                return "Erased"
            } catch (error) {
                return `Error: ${error.message}`;
            }
        }
    };
});

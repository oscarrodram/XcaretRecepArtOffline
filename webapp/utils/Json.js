sap.ui.define([
    "com/xcaret/recepcionarticulosoff/utils/Services",
    "com/xcaret/recepcionarticulosoff/utils/Users"
], function (Services, Users) {
    "use strict";

    return {
        CreateSession: function(oController, sEBELN) {
            let oUser = Users.getUserInfo();
            
            console.log("🔍 CreateSession - EBELN recibido:", sEBELN);
            console.log("🔍 CreateSession - Usuario completo:", oUser);
            console.log("🔍 CreateSession - sUserId disponible:", oUser?.sUserId);
            console.log("🔍 CreateSession - Tipo de sUserId:", typeof oUser?.sUserId);
            
            // Validar que se proporcione EBELN
            if (!sEBELN) {
                console.error("❌ CreateSession: EBELN no proporcionado");
                return null;
            }
            
            // Validar que el usuario tenga ID
            if (!oUser || !oUser.sUserId) {
                console.error("❌ CreateSession: Usuario o sUserId no encontrado");
                console.error("❌ CreateSession - Estado del usuario:", {
                    userExists: !!oUser,
                    userKeys: oUser ? Object.keys(oUser) : 'N/A',
                    sUserIdValue: oUser?.sUserId,
                    sUserIdType: typeof oUser?.sUserId
                });
                return null;
            }
            
            let oSessions = [];
            let oSession = { 
                TABLE_NAME: "MSEG",
                INT_ID: sEBELN,
                LAST_TIME: Date.now(),
                ERNAM: this._createHybridERNAM(oUser.sUserId, oUser.sFirstName, oUser.sLastName),
                ACTIVE: "X"
            }
            
            console.log("✅ CreateSession - Sesión creada exitosamente:", oSession);
            oSessions.push(oSession);
            return oSessions;
        },

        UpdateSession: function(oController, sEBELN) {
            let oUser = Users.getUserInfo();
            
            // Validar que se proporcione EBELN
            if (!sEBELN) {
                console.error("❌ UpdateSession: EBELN no proporcionado");
                return null;
            }
            
            // Validar que el usuario tenga ID
            if (!oUser || !oUser.sUserId) {
                console.error("❌ UpdateSession: Usuario o sUserId no encontrado");
                return null;
            }
            
            let oSessions = [];
            let oSession = { 
                TABLE_NAME: "MSEG",
                INT_ID: sEBELN,
                LAST_TIME: Date.now().toString(),
                ERNAM: this._createHybridERNAM(oUser.sUserId, oUser.sFirstName, oUser.sLastName),
                ACTIVE: "X"
            }
            
            oSessions.push(oSession);
            return oSessions;
        },

        /**
         * Crea un ERNAM híbrido con formato: "8charsUUID_NOMBRE_APELLIDO"
         * @param {string} sUserId - ID completo del usuario
         * @param {string} sFirstName - Nombre del usuario
         * @param {string} sLastName - Apellido del usuario
         * @returns {string} ERNAM híbrido limitado a 36 caracteres
         */
        _createHybridERNAM: function(sUserId, sFirstName, sLastName) {
            // Extraer solo los primeros 8 caracteres del UUID
            const shortUserId = sUserId ? sUserId.substring(0, 8) : "";
            
            // Crear nombre completo
            const fullName = `${sFirstName || ""} ${sLastName || ""}`.trim();
            
            // Crear ERNAM híbrido
            let hybridERNAM = `${shortUserId}_${fullName}`;
            
            // Limitar a 36 caracteres si es necesario
            if (hybridERNAM.length > 36) {
                // Calcular cuántos caracteres podemos usar para el nombre
                const availableForName = 36 - shortUserId.length - 1; // -1 por el guión bajo
                
                if (availableForName > 0) {
                    // Truncar el nombre completo a los caracteres disponibles
                    hybridERNAM = `${shortUserId}_${fullName.substring(0, availableForName)}`;
                } else {
                    // Si no hay espacio para nombre, usar solo el ID corto
                    hybridERNAM = shortUserId;
                }
            }
            
            console.log("✅ ERNAM híbrido creado:", hybridERNAM, "Longitud:", hybridERNAM.length);
            return hybridERNAM;
        }
    };
});

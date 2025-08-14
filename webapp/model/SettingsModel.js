sap.ui.define(["sap/ui/model/json/JSONModel"], function (JSONModel) {
    "use strict";

    return {
        createSettingsModel: function () {
            let oModel = new JSONModel({
                EBELN: true,
                ID_CON: true,
                EBELN1: true,
                GENERAL_STATUS: true,
                LIFNR: true,
                ZTERM: true,
                WAERS: true,
                ERNAM: true,
                ERNAM2: false,
                AEDAT: true,
                LOEKZ: true,
                NAMEP: true,
                CARGO: true,
                CONF: true,
                BSTYP: false,
                EMAIL: false,
                FRATE: false,
                LNAME: false,
                NAME: false,
                PSPNR: false,
                WKURS: false
            });
            return oModel;
        },

        createSettingsModelTable: function () {
            let oModel = new JSONModel({
                EBELN: true,
                PSPNR: true,
                LIFNR: true,
                GENERAL_STATUS: true,
                ESTAT: false,
                CREATED_AT: true,
                CREATION_NAME: false,
                CREATION_LNAME: false,
                CREATION_EMAIL: false,
                MODIFY_NAME: false,
                MODIFY_LNAME: false,
                MODIFY_EMAIL: false,
                RANK: false
            });
            return oModel;
        },
        createSettingsModelStatus: function () {
            let oModel = new JSONModel([
                {
                    ID: "1",
                    Icon: "sap-icon://process",
                    State: "Warning"
                },
                {
                    ID: "2",
                    Icon: "sap-icon://money-bills",
                    State: "Information"
                },
                {
                    ID: "3",
                    Icon: "sap-icon://sys-minus",
                    State: "Information"
                },
                {
                    ID: "4",
                    Icon: "sap-icon://sys-enter-2",
                    State: "Success"
                },
                {
                    ID: "5",
                    Icon: "sap-icon://delete",
                    State: "Error"
                },
                {
                    ID: "6",
                    Icon: "sap-icon://document-text",
                    State: "Success"
                }
            ]);
            return oModel;
        },
        createSettingsModelItem: function () {
            let oModel = new JSONModel({
                EBELP: true, //Posición (1)
                IMAG: true, //Imagen (2)
                GENERAL_STATUS: true,
                LINENAME: true, //Nombre = MAT_MATNR + MAT_NAME
                MENGE: true, //Cantidad comprada //REQ_MENGE_C
                QTY_AVA: true,
                QTY_DELIV: true, //Cantidad a entregar
                QTY_DELIV_COPY: true, //Cantidad a entregar
                RECEP_XDIFICA: true, //Recept Xdifica
                CATEGORY: true, //Categoria
                FAMILY: true, //Familia
                BRAND: true, //Marca
                MODEL: true, //Modelo
                DIMENSIONS: true, //Dimensiones
                STANDARD_IND: true, //Ind. Estandar
                IND_ACT_FIJO: true, //Ind Activo Fijo
                HERITAGE: true, //Patrimonio
                SPECIALS: true, //Especiales,
                FFE: true, //FFE FM FFE DI
                DIVISION: true, //División
                AREA: true, //Área
                LOCATION: true, //Ubicación
                SUBLOCATION: true, //Sub ubicación
                SUPPLIED: true, //Suministrado
                VIEW: true, //Vista                
                CREATION_NAME: false,
                CREATION_LNAME: false,
                CREATION_EMAIL: false,
                MODIFY_NAME: false,
                MODIFY_LNAME: false,
                MODIFY_EMAIL: false,
                RANK: false
            });
            return oModel;
        },
        createSettingsModelIcon: function () {
            let oModel = new JSONModel({
                DESCRIPTION: "",
                ID: "",
                PROCESS: ""
            });
            return oModel;
        }


    };
});

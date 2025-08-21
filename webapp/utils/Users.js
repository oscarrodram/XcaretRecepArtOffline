sap.ui.define([], function () {
    "use strict";

    return {
        getUserInfo: function(){
            let oUserInfo = {};
            if (sap.ushell && sap.ushell.Container) {
                const oUser = sap.ushell.Container.getUser();
                oUserInfo.sUserId = oUser.getId();
                oUserInfo.sFirstName = oUser.getFirstName();
                oUserInfo.sLastName = oUser.getLastName();
                oUserInfo.sEmail = oUser.getEmail();
            }
            return oUserInfo;
        },
    };
});

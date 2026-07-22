sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], (Controller,JSONModel) => {
    "use strict";

    return Controller.extend("com.origin.timesheet.ui.controller.App", {
        onInit() {
            this.getView().setModel(new JSONModel({
                userId: '',
                givenName: '',
                familyName:''
            }),"UIModel")
            this._getLoginUserInfo();
        },
        _getLoginUserInfo: async function () {
            try {
                const oModel = this.getOwnerComponent().getModel();

                const oFunction = oModel.bindContext(
                    "/getLoginUserInfo(...)"
                );

                await oFunction.execute();

                const oResponse = oFunction.getBoundContext().getObject();

                var oUIModel = this.getView().getModel("UIModel");
                if(oUIModel){
                    oUIModel.setProperty("/userId",oResponse.userId)
                    oUIModel.setProperty("/givenName",oResponse.givenName)
                    oUIModel.setProperty("/familyName",oResponse.familyName)
                
                }
       
            } catch (oError) {
                console.error("Failed to get login user info:", oError);
            }
        }
    });
});
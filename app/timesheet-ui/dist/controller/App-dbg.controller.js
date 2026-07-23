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
        },
         onLoadTimesheet: async function () {

            const oModel = this.getOwnerComponent().getModel();

            const oBinding = oModel.bindContext(
                "/getTimesheet(period=2026-07-13)"
            );

            try {

                await oBinding.execute();

                const oResult = oBinding.getBoundContext().getObject();

                console.log("Timesheet:");

                console.log(oResult);

            } catch (oError) {

                console.error(oError);

            }

        }
    });
});
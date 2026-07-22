import cds from '@sap/cds';

interface LoginUserInfo {
  userId: string;
  givenName: string;
  familyName:string;
  roles: any;
}

export default class TimesheetService extends cds.ApplicationService {
  async init(): Promise<void> {
    this.on('getLoginUserInfo', (req: cds.Request): LoginUserInfo => {
      const user = req.user;
      const attributes = user.attr ?? {};

      const givenName = String( attributes?.givenName ??
        ''
      );
      const familyName = String(attributes?.familyName ??
        ''
      );
      const roles = user?.roles;
      return {
        userId: user.id,
        givenName,
        familyName,
        roles
      };
    });

    await super.init();
  }
}
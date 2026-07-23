
import cds from '@sap/cds';
import {
    getLoginUserInfo,
    getTimesheet,
    LoginUserInfo
} from "#cds-models/com/origin/timesheet/TimesheetService";
const { SELECT } = cds.ql;




export default class TimesheetService extends cds.ApplicationService {
  async init(): Promise<void> {
    this.on(getLoginUserInfo, this.getLoginUserInfo);

    this.on(getTimesheet, this.getTimesheet);

    await super.init();
  }

  private getLoginUserInfo =(req: cds.Request): LoginUserInfo => {
      const user = req.user;
      const attributes = user.attr ?? {};
      const givenName = String( attributes?.givenName ??
        ''
      );
      const familyName = String(attributes?.familyName ??
        ''
      );
      return {
        userId: user.id,
        givenName,
        familyName,
        persona:'WFS_CATS'//need to update this logic
      };
    }

     private formatDate(date:Date){
        return date
            .toISOString()
            .substring(0,10);
    }

     private displayDate(dateString:string){
        return new Intl.DateTimeFormat(
            "en-AU",
            {
                day:"numeric",
                month:"long",
                year:"numeric",
                timeZone:"UTC"
            }
        ).format(
            new Date(dateString)

        );

    }


    private getTimesheet = async (req: cds.Request) => {
        const period = String(req.data.period ?? "");

        this.validatePeriod(period);

        const user = this.getLoginUserInfo(req);

        const startDate = new Date(`${period}T00:00:00Z`);
        const endDate = new Date(startDate);

        if (user.persona === "CATS") {
            endDate.setUTCDate(startDate.getUTCDate() + 6);
        } else {
            endDate.setUTCDate(startDate.getUTCDate() + 13);
        }

        const start = this.formatDate(startDate);
        const end = this.formatDate(endDate);

        const { Timesheets } = this.entities;

        const result = await SELECT.one
            .from(Timesheets)
            .columns((c: any) => {
                c("*");
                c.entries((e: any) => {
                    e("*");
                });
            })
            .where({
                employeeId: user.userId,
                startDate: start,
                endDate: end
            });

        return {
            timesheetId: result?.ID ?? null,
            employeeName: user.givenName,
            employeeNumber: user.userId,
            persona: user.persona,
            periodStart: start,
            periodEnd: end,
            periodDisplay:
                `${this.displayDate(start)} - ${this.displayDate(end)}`,
            wfsStatus:
                result?.wfsSubmissionStatus ?? "NEW",
            confirmationStatus:
                result?.confirmationStatus ?? "NEW",
            wfsSubmissionStatus:
                result?.wfsSubmissionStatus ?? "NOT_SUBMITTED",
            sapSubmissionStatus:
                result?.sapSubmissionStatus ?? "NOT_SUBMITTED",
            entries:
                result?.entries ?? []
        };
    };

    private validatePeriod(period: string): void {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) {
        throw cds.error("Period must be YYYY-MM-DD.", {
            status: 400
        });
    }

    const date = new Date(`${period}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
        throw cds.error("Invalid period.", {
            status: 400
        });
    }

    if (date.getUTCDay() !== 1) {
        throw cds.error("Period must start on a Monday.", {
            status: 400
        });
    }
}
}
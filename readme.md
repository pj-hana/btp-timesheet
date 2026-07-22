# Getting Started

Welcome to your new CAP project.

It contains these folders and files, following our recommended project layout:

File or Folder | Purpose
---------|----------
`app/` | content for UI frontends goes here
`db/` | your domain models and data go here
`srv/` | your service models and code go here
`readme.md` | this getting started guide

## Next Steps

- Open a new terminal and run `cds watch`
- (in VS Code simply choose _**Terminal** > Run Task > cds watch_)
- Start with your domain model, in a CDS file in `db/`

## Learn More

Learn more at <https://cap.cloud.sap>.

## on local test change. for deploy rollback all the changes.  
 "xsappname" to  "timesheet-DEV" in xs-security.json, 
add   "oauth2-configuration": {
    "redirect-uris": [
       "https://*.applicationstudio.cloud.sap/**"
    ]
  }, to xs-security.json
in app/roouter/xs-app.json change to this
  {
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/(.*)$",
      "target": "/odata/$1",
      "destination": "local-cap",
      "authenticationType": "xsuaa",
      "csrfProtection": false
    },
    {
      "source": "^/(.*)$",
      "localDir": "../timesheet-ui/webapp",
      "authenticationType": "xsuaa"
    }
  ]
}
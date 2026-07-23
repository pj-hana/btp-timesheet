// CAP's service factory only considers `.ts` sibling implementation files when this is set
// (node_modules/@sap/cds/lib/srv/factory.js) — required for cds.test() to load wfs-service.ts.
process.env.CDS_TYPESCRIPT = 'true';

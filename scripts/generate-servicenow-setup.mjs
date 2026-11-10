// Generates servicenow/setup-handoverai.js — a ServiceNow Background Script that creates
// the HandoverAI tables, columns, choices, auto-number, integration role, ACLs and seed
// records. Generated from lib/servicenow/schema.ts so names always match the app.
// Usage: node scripts/generate-servicenow-setup.mjs   (Node 22.18+)
import fs from "node:fs";
import { TABLES } from "../lib/servicenow/schema.ts";
import { AI_SECTIONS } from "../lib/documents/sections.ts";

const TYPE = { string: "string", json: "string", number: "integer", decimal: "decimal", boolean: "boolean", reference: "reference", datetime: "glide_date_time", choice: "string" };
// Create referenced tables first.
const ORDER = ["employee_profile", "document_template", "project", "module_configuration", "document_request", "generated_document", "document_version", "document_approval", "ai_generation_log"];

const tables = ORDER.map((key) => {
  const t = TABLES[key];
  return {
    key,
    label: t.label,
    autoNumber: t.autoNumber || "",
    columns: Object.values(t.fields).map((f) => ({
      element: f.column,
      label: f.label,
      type: TYPE[f.type],
      maxLength: f.type === "string" || f.type === "json" || f.type === "choice" ? f.maxLength || 100 : 0,
      reference: f.reference || "",
      choices: f.choices || [],
      mandatory: Boolean(f.mandatory),
      defaultValue: f.column === "active" ? "true" : "",
    })),
  };
});

const script = `/*
 * HandoverAI — ServiceNow setup script (generated; do not edit by hand)
 * Run in: System Definition > Scripts - Background, scope "global", AFTER elevating to security_admin.
 * Safe to run more than once: anything that already exists is skipped.
 */
(function () {
  var SCOPE = 'CHANGE_ME';          // your application scope, e.g. x_2308807_hai
  var ADMIN_USER = 'admin';          // ServiceNow user_name that gets the HandoverAI admin profile

  var TABLES = ${JSON.stringify(tables, null, 1)};
  var DEFAULT_SECTIONS = ${JSON.stringify(AI_SECTIONS.map((s) => s.key))};

  var created = 0, skipped = 0, errors = 0;
  function ok(msg) { gs.print('OK    ' + msg); created++; }
  function skip(msg) { gs.print('SKIP  ' + msg); skipped++; }
  function fail(msg) { gs.print('ERROR ' + msg); errors++; }

  var app = new GlideRecord('sys_app');
  if (SCOPE === 'CHANGE_ME' || !app.get('scope', SCOPE)) { gs.print('ERROR Application with scope "' + SCOPE + '" not found. Edit SCOPE at the top of the script.'); return; }
  var appId = app.getUniqueValue();
  gs.print('Application: ' + app.getValue('name') + ' (' + SCOPE + ')');

  // 1. Tables
  TABLES.forEach(function (t) {
    var name = SCOPE + '_' + t.key;
    var tbl = new GlideRecord('sys_db_object');
    if (tbl.get('name', name)) { skip('table ' + name); return; }
    tbl.initialize();
    tbl.setValue('name', name);
    tbl.setValue('label', t.label);
    tbl.setValue('sys_scope', appId);
    tbl.setValue('ws_access', true);
    tbl.setValue('create_access_controls', false);
    if (tbl.insert()) ok('table ' + name); else fail('table ' + name + ' could not be created');
  });

  // 2. Columns + choices
  TABLES.forEach(function (t) {
    var name = SCOPE + '_' + t.key;
    if (!new GlideRecord('sys_db_object').get('name', name)) { fail('missing table ' + name + ', columns skipped'); return; }
    t.columns.forEach(function (c) {
      var d = new GlideRecord('sys_dictionary');
      d.addQuery('name', name); d.addQuery('element', c.element); d.query();
      if (d.next()) { skip('column ' + name + '.' + c.element); }
      else {
        d.initialize();
        d.setValue('name', name);
        d.setValue('element', c.element);
        d.setValue('column_label', c.label);
        d.setValue('internal_type', c.type);
        d.setValue('sys_scope', appId);
        if (c.maxLength) d.setValue('max_length', c.maxLength);
        if (c.reference) d.setValue('reference', SCOPE + '_' + c.reference);
        if (c.mandatory) d.setValue('mandatory', true);
        if (c.defaultValue) d.setValue('default_value', c.defaultValue);
        if (c.choices.length) d.setValue('choice', 1);
        if (c.element === 'number' && t.autoNumber) d.setValue('default_value', 'javascript:global.getNextObjNumberPadded();');
        if (d.insert()) ok('column ' + name + '.' + c.element); else { fail('column ' + name + '.' + c.element); return; }
      }
      c.choices.forEach(function (v, i) {
        var ch = new GlideRecord('sys_choice');
        ch.addQuery('name', name); ch.addQuery('element', c.element); ch.addQuery('value', v); ch.query();
        if (ch.next()) return;
        ch.initialize();
        ch.setValue('name', name); ch.setValue('element', c.element); ch.setValue('value', v); ch.setValue('label', v);
        ch.setValue('sequence', i * 10); ch.setValue('language', 'en'); ch.setValue('sys_scope', appId);
        if (ch.insert()) ok('choice ' + name + '.' + c.element + ' = ' + v); else fail('choice ' + v);
      });
    });
    // Auto-number (document_request)
    if (t.autoNumber) {
      var num = new GlideRecord('sys_number');
      if (num.get('category', name)) skip('auto-number ' + name);
      else {
        num.initialize();
        num.setValue('category', name); num.setValue('prefix', t.autoNumber); num.setValue('number', 1000); num.setValue('maximum_digits', 7); num.setValue('sys_scope', appId);
        if (num.insert()) ok('auto-number ' + t.autoNumber + ' on ' + name); else fail('auto-number ' + name);
      }
    }
  });

  // 3. Integration role
  var roleName = SCOPE + '.integration';
  var role = new GlideRecord('sys_user_role');
  if (role.get('name', roleName)) skip('role ' + roleName);
  else {
    role.initialize(); role.setValue('name', roleName); role.setValue('sys_scope', appId);
    role.setValue('description', 'HandoverAI integration user: read/create/write on HandoverAI tables');
    if (role.insert()) ok('role ' + roleName); else fail('role ' + roleName);
  }
  if (!role.isValidRecord() && !role.get('name', roleName)) { fail('role not available, ACLs skipped'); }
  else {
    // 4. ACLs (needs security_admin elevation)
    ['read', 'create', 'write'].forEach(function (op) {
      var opRec = new GlideRecord('sys_security_operation');
      if (!opRec.get('name', op)) { fail('operation ' + op + ' not found'); return; }
      TABLES.forEach(function (t) {
        [SCOPE + '_' + t.key, SCOPE + '_' + t.key + '.*'].forEach(function (aclName) {
          var acl = new GlideRecord('sys_security_acl');
          acl.addQuery('name', aclName); acl.addQuery('operation', opRec.getUniqueValue()); acl.query();
          if (acl.next()) { skip('ACL ' + op + ' ' + aclName); return; }
          acl.initialize();
          acl.setValue('name', aclName); acl.setValue('type', 'record'); acl.setValue('operation', opRec.getUniqueValue());
          acl.setValue('active', true); acl.setValue('admin_overrides', true); acl.setValue('sys_scope', appId);
          var aclId = acl.insert();
          if (!aclId) { fail('ACL ' + op + ' ' + aclName + ' (did you elevate to security_admin?)'); return; }
          var ar = new GlideRecord('sys_security_acl_role');
          ar.initialize(); ar.setValue('sys_security_acl', aclId); ar.setValue('sys_user_role', role.getUniqueValue());
          ar.insert();
          ok('ACL ' + op + ' ' + aclName);
        });
      });
    });
  }

  // 5. Seed: admin employee profile + standard template
  var prof = new GlideRecord(SCOPE + '_employee_profile');
  if (!prof.isValid()) fail('employee profile table not usable');
  else if (prof.get('user_name', ADMIN_USER)) skip('employee profile ' + ADMIN_USER);
  else {
    var u = new GlideRecord('sys_user'); u.get('user_name', ADMIN_USER);
    prof.initialize();
    prof.setValue('user_name', ADMIN_USER);
    prof.setValue('full_name', u.isValidRecord() ? (u.getValue('name') || 'System Administrator') : 'System Administrator');
    prof.setValue('email', u.isValidRecord() ? (u.getValue('email') || '') : '');
    prof.setValue('role', 'admin'); prof.setValue('active', true); prof.setValue('department', 'Platform');
    if (prof.insert()) ok('employee profile ' + ADMIN_USER + ' (admin)'); else fail('employee profile ' + ADMIN_USER);
  }
  var tpl = new GlideRecord(SCOPE + '_document_template');
  if (tpl.isValid()) {
    if (tpl.get('name', 'Standard Module Handover')) skip('template Standard Module Handover');
    else {
      tpl.initialize();
      tpl.setValue('name', 'Standard Module Handover'); tpl.setValue('document_type', 'Technical Handover');
      tpl.setValue('description', 'Full handover document for a ServiceNow module.');
      tpl.setValue('sections_json', JSON.stringify(DEFAULT_SECTIONS));
      tpl.setValue('instructions', 'Write for a new administrator who knows ServiceNow but has never seen this module.');
      tpl.setValue('manual_effort_hours', 16); tpl.setValue('active', true);
      if (tpl.insert()) ok('template Standard Module Handover'); else fail('template');
    }
  }

  gs.print('');
  gs.print('DONE: ' + created + ' created, ' + skipped + ' already existed, ' + errors + ' errors.');
  if (errors) gs.print('Fix the ERROR lines above, then run the script again (it skips what already exists).');
})();
`;
fs.mkdirSync("servicenow", { recursive: true });
fs.writeFileSync("servicenow/setup-handoverai.js", script);
console.log(`Wrote servicenow/setup-handoverai.js (${tables.length} tables, ${tables.reduce((s, t) => s + t.columns.length, 0)} columns)`);

/*
 * HandoverAI — ServiceNow setup script (generated; do not edit by hand)
 * Run in: System Definition > Scripts - Background, scope "global", AFTER elevating to security_admin.
 * Safe to run more than once: anything that already exists is skipped.
 */
(function () {
  var SCOPE = 'CHANGE_ME';          // your application scope, e.g. x_2308807_hai
  var ADMIN_USER = 'admin';          // ServiceNow user_name that gets the HandoverAI admin profile

  var TABLES = [
 {
  "key": "employee_profile",
  "label": "Employee Profile",
  "autoNumber": "",
  "columns": [
   {
    "element": "user_name",
    "label": "User Name",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [],
    "mandatory": true,
    "defaultValue": ""
   },
   {
    "element": "full_name",
    "label": "Full Name",
    "type": "string",
    "maxLength": 200,
    "reference": "",
    "choices": [],
    "mandatory": true,
    "defaultValue": ""
   },
   {
    "element": "email",
    "label": "Email",
    "type": "string",
    "maxLength": 200,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "department",
    "label": "Department",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "job_title",
    "label": "Job Title",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "role",
    "label": "Role",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [
     "employee",
     "admin"
    ],
    "mandatory": true,
    "defaultValue": ""
   },
   {
    "element": "active",
    "label": "Active",
    "type": "boolean",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": "true"
   }
  ]
 },
 {
  "key": "document_template",
  "label": "Document Template",
  "autoNumber": "",
  "columns": [
   {
    "element": "name",
    "label": "Name",
    "type": "string",
    "maxLength": 200,
    "reference": "",
    "choices": [],
    "mandatory": true,
    "defaultValue": ""
   },
   {
    "element": "document_type",
    "label": "Document Type",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "description",
    "label": "Description",
    "type": "string",
    "maxLength": 1000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "sections_json",
    "label": "Sections (JSON array of keys)",
    "type": "string",
    "maxLength": 4000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "instructions",
    "label": "AI Instructions",
    "type": "string",
    "maxLength": 4000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "manual_effort_hours",
    "label": "Manual Effort (hours)",
    "type": "decimal",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "active",
    "label": "Active",
    "type": "boolean",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": "true"
   }
  ]
 },
 {
  "key": "project",
  "label": "Project",
  "autoNumber": "",
  "columns": [
   {
    "element": "name",
    "label": "Name",
    "type": "string",
    "maxLength": 200,
    "reference": "",
    "choices": [],
    "mandatory": true,
    "defaultValue": ""
   },
   {
    "element": "project_id",
    "label": "Project ID",
    "type": "string",
    "maxLength": 50,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "application_name",
    "label": "Application Name",
    "type": "string",
    "maxLength": 200,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "department",
    "label": "Business Department",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "owner",
    "label": "Owner",
    "type": "reference",
    "maxLength": 0,
    "reference": "employee_profile",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "description",
    "label": "Description",
    "type": "string",
    "maxLength": 4000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "status",
    "label": "Status",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [
     "active",
     "on_hold",
     "completed"
    ],
    "mandatory": false,
    "defaultValue": ""
   }
  ]
 },
 {
  "key": "module_configuration",
  "label": "Module Configuration",
  "autoNumber": "",
  "columns": [
   {
    "element": "project",
    "label": "Project",
    "type": "reference",
    "maxLength": 0,
    "reference": "project",
    "choices": [],
    "mandatory": true,
    "defaultValue": ""
   },
   {
    "element": "module_name",
    "label": "Module Name",
    "type": "string",
    "maxLength": 200,
    "reference": "",
    "choices": [],
    "mandatory": true,
    "defaultValue": ""
   },
   {
    "element": "module_owner",
    "label": "Module Owner",
    "type": "string",
    "maxLength": 200,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "business_department",
    "label": "Business Department",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "document_type",
    "label": "Document Type",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "description",
    "label": "Description",
    "type": "string",
    "maxLength": 4000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "config_json",
    "label": "Configuration (JSON)",
    "type": "string",
    "maxLength": 1000000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   }
  ]
 },
 {
  "key": "document_request",
  "label": "Document Request",
  "autoNumber": "HDR",
  "columns": [
   {
    "element": "number",
    "label": "Number",
    "type": "string",
    "maxLength": 40,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "project",
    "label": "Project",
    "type": "reference",
    "maxLength": 0,
    "reference": "project",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "module_configuration",
    "label": "Module Configuration",
    "type": "reference",
    "maxLength": 0,
    "reference": "module_configuration",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "requested_by",
    "label": "Requested By",
    "type": "reference",
    "maxLength": 0,
    "reference": "employee_profile",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "title",
    "label": "Title",
    "type": "string",
    "maxLength": 200,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "document_type",
    "label": "Document Type",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "template",
    "label": "Template",
    "type": "reference",
    "maxLength": 0,
    "reference": "document_template",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "state",
    "label": "State",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [
     "open",
     "generated",
     "closed"
    ],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "reference_text",
    "label": "Reference Text (from uploads)",
    "type": "string",
    "maxLength": 100000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   }
  ]
 },
 {
  "key": "generated_document",
  "label": "Generated Document",
  "autoNumber": "",
  "columns": [
   {
    "element": "document_request",
    "label": "Document Request",
    "type": "reference",
    "maxLength": 0,
    "reference": "document_request",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "project",
    "label": "Project",
    "type": "reference",
    "maxLength": 0,
    "reference": "project",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "author",
    "label": "Author",
    "type": "reference",
    "maxLength": 0,
    "reference": "employee_profile",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "title",
    "label": "Title",
    "type": "string",
    "maxLength": 200,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "state",
    "label": "State",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [
     "draft",
     "ai_generated",
     "under_review",
     "changes_requested",
     "rejected",
     "approved",
     "published"
    ],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "current_version",
    "label": "Current Version",
    "type": "integer",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "content_json",
    "label": "Content (JSON)",
    "type": "string",
    "maxLength": 1000000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "mermaid_code",
    "label": "Mermaid Code",
    "type": "string",
    "maxLength": 20000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "analysis_json",
    "label": "Analysis (JSON)",
    "type": "string",
    "maxLength": 65000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "generation_seconds",
    "label": "Generation Seconds",
    "type": "integer",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "estimated_hours_saved",
    "label": "Estimated Hours Saved",
    "type": "decimal",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "submitted_on",
    "label": "Submitted On",
    "type": "glide_date_time",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "approved_on",
    "label": "Approved On",
    "type": "glide_date_time",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "published_on",
    "label": "Published On",
    "type": "glide_date_time",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   }
  ]
 },
 {
  "key": "document_version",
  "label": "Document Version",
  "autoNumber": "",
  "columns": [
   {
    "element": "generated_document",
    "label": "Generated Document",
    "type": "reference",
    "maxLength": 0,
    "reference": "generated_document",
    "choices": [],
    "mandatory": true,
    "defaultValue": ""
   },
   {
    "element": "version_number",
    "label": "Version Number",
    "type": "integer",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "content_json",
    "label": "Content (JSON)",
    "type": "string",
    "maxLength": 1000000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "mermaid_code",
    "label": "Mermaid Code",
    "type": "string",
    "maxLength": 20000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "change_summary",
    "label": "Change Summary",
    "type": "string",
    "maxLength": 1000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "created_by_profile",
    "label": "Created By",
    "type": "reference",
    "maxLength": 0,
    "reference": "employee_profile",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   }
  ]
 },
 {
  "key": "document_approval",
  "label": "Document Approval",
  "autoNumber": "",
  "columns": [
   {
    "element": "generated_document",
    "label": "Generated Document",
    "type": "reference",
    "maxLength": 0,
    "reference": "generated_document",
    "choices": [],
    "mandatory": true,
    "defaultValue": ""
   },
   {
    "element": "version_number",
    "label": "Version Number",
    "type": "integer",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "actor",
    "label": "Actor",
    "type": "reference",
    "maxLength": 0,
    "reference": "employee_profile",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "action",
    "label": "Action",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [
     "submitted",
     "approved",
     "rejected",
     "changes_requested",
     "published",
     "comment"
    ],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "comments",
    "label": "Comments",
    "type": "string",
    "maxLength": 4000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   }
  ]
 },
 {
  "key": "ai_generation_log",
  "label": "AI Generation Log",
  "autoNumber": "",
  "columns": [
   {
    "element": "operation",
    "label": "Operation",
    "type": "string",
    "maxLength": 60,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "model",
    "label": "Model",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "document_request",
    "label": "Document Request",
    "type": "reference",
    "maxLength": 0,
    "reference": "document_request",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "generated_document",
    "label": "Generated Document",
    "type": "reference",
    "maxLength": 0,
    "reference": "generated_document",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "user",
    "label": "User",
    "type": "reference",
    "maxLength": 0,
    "reference": "employee_profile",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "prompt_tokens",
    "label": "Prompt Tokens",
    "type": "integer",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "completion_tokens",
    "label": "Completion Tokens",
    "type": "integer",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "duration_ms",
    "label": "Duration (ms)",
    "type": "integer",
    "maxLength": 0,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "status",
    "label": "Status",
    "type": "string",
    "maxLength": 100,
    "reference": "",
    "choices": [
     "success",
     "error"
    ],
    "mandatory": false,
    "defaultValue": ""
   },
   {
    "element": "error_message",
    "label": "Error Message",
    "type": "string",
    "maxLength": 4000,
    "reference": "",
    "choices": [],
    "mandatory": false,
    "defaultValue": ""
   }
  ]
 }
];
  var DEFAULT_SECTIONS = ["executive_summary","project_overview","module_overview","business_purpose","scope","functional_description","technical_architecture","configuration_details","categories","business_rules","workflow_routing","assignment_groups","approval_process","roles_responsibilities","integrations","exception_handling","notifications","testing_scenarios","troubleshooting","known_issues","faq","handover_checklist","future_recommendations"];

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

/*
 * HandoverAI — ServiceNow setup script 2 of 2 (generated; do not edit by hand)
 * Adds the first admin employee profile and the standard document template.
 * Run in: System Definition > Scripts - Background, scope = your HandoverAI app (NOT global).
 * Safe to run more than once.
 */
(function () {
  var SCOPE = 'CHANGE_ME';   // your application scope, e.g. x_2308807_hai
  var ADMIN_USER = 'admin';   // ServiceNow user_name that becomes the HandoverAI admin
  var DEFAULT_SECTIONS = ["executive_summary","project_overview","module_overview","business_purpose","scope","functional_description","technical_architecture","configuration_details","categories","business_rules","workflow_routing","assignment_groups","approval_process","roles_responsibilities","integrations","exception_handling","notifications","testing_scenarios","troubleshooting","known_issues","faq","handover_checklist","future_recommendations"];

  var prof = new GlideRecord(SCOPE + '_employee_profile');
  if (!prof.isValid()) { gs.info('ERROR table ' + SCOPE + '_employee_profile not found. Check SCOPE and run script 1 first.'); return; }
  if (prof.get('user_name', ADMIN_USER)) gs.info('SKIP  employee profile ' + ADMIN_USER + ' already exists');
  else {
    prof.initialize();
    prof.setValue('user_name', ADMIN_USER);
    prof.setValue('full_name', 'System Administrator');
    prof.setValue('department', 'Platform');
    prof.setValue('role', 'admin');
    prof.setValue('active', true);
    gs.info(prof.insert() ? 'OK    employee profile ' + ADMIN_USER + ' (admin)' : 'ERROR employee profile not created');
  }

  var tpl = new GlideRecord(SCOPE + '_document_template');
  if (tpl.get('name', 'Standard Module Handover')) gs.info('SKIP  template already exists');
  else {
    tpl.initialize();
    tpl.setValue('name', 'Standard Module Handover');
    tpl.setValue('document_type', 'Technical Handover');
    tpl.setValue('description', 'Full handover document for a ServiceNow module.');
    tpl.setValue('sections_json', JSON.stringify(DEFAULT_SECTIONS));
    tpl.setValue('instructions', 'Write for a new administrator who knows ServiceNow but has never seen this module.');
    tpl.setValue('manual_effort_hours', 16);
    tpl.setValue('active', true);
    gs.info(tpl.insert() ? 'OK    template Standard Module Handover' : 'ERROR template not created');
  }
  gs.info('DONE seed script.');
})();

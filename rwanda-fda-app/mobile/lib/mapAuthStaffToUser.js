/**
 * Normalize Monitoring Tool `auth.php` JSON (`data.user` + nested `data.staff`)
 * into the flat `user` object stored after login (Profile, dashboard sync, staff_id).
 *
 * @param {object} payload – Full JSON body from auth (expects `payload.data` when wrapped).
 * @param {string} [fallbackEmail] – Email used in the login form if missing in payload.
 * @returns {{ user: object, token: string|null, expiresAt: string|null }}
 */
export function mapPhpAuthPayloadToUser(payload, fallbackEmail = '') {
  const data = payload?.data != null && typeof payload.data === 'object' ? payload.data : payload || {};
  const apiUser = data.user && typeof data.user === 'object' ? data.user : {};
  const staff = data.staff && typeof data.staff === 'object' ? data.staff : null;

  const emailGuess =
    String(apiUser.user_email || apiUser.email || staff?.staff_email || fallbackEmail || '').trim();

  const baseUser = {
    id: apiUser.user_id ?? apiUser.id ?? staff?.staff_id ?? null,
    staff_id: staff?.staff_id != null ? Number(staff.staff_id) : apiUser.staff_id != null ? Number(apiUser.staff_id) : null,
    email: emailGuess || null,
    access: apiUser.user_access ?? apiUser.role ?? null,
    roleId: apiUser.role_id != null ? Number(apiUser.role_id) : null,
  };

  const tokenRaw =
    data.token ??
    data.access_token ??
    payload?.token ??
    payload?.access_token ??
    apiUser.token ??
    '';
  const token = tokenRaw != null ? String(tokenRaw).trim() : '';
  const expiresAt = data.expires_at != null ? String(data.expires_at) : null;

  if (!staff) {
    return {
      user: {
        ...baseUser,
        name: apiUser.name || emailGuess || 'Staff',
        ...(apiUser.phone ? { phone: apiUser.phone } : {}),
        ...(apiUser.department ? { dutyStation: apiUser.department } : {}),
      },
      token: token || null,
      expiresAt,
    };
  }

  const pos = staff.position && typeof staff.position === 'object' ? staff.position : null;
  const org = staff.org_unit && typeof staff.org_unit === 'object' ? staff.org_unit : null;
  const parentOrg = org?.parent && typeof org.parent === 'object' ? org.parent : null;
  const sup = staff.supervisor && typeof staff.supervisor === 'object' ? staff.supervisor : null;

  const reports_to = sup
    ? {
        name: sup.staff_names || 'Supervisor',
        email: sup.staff_email || null,
        department: parentOrg?.org_unit_name || org?.org_unit_name || null,
        staff_group: null,
        role: null,
      }
    : null;

  const direct_reports = Array.isArray(staff.subordinates)
    ? staff.subordinates.map((s) => ({
        staff_id: s.staff_id,
        name: s.staff_names || 'Staff',
        email: s.staff_email || null,
        department: s.org_unit_name || s.duty_station || null,
        staff_group: s.staff_group || s.group || s.staff_group_name || null,
        staff_status:
          s.staff_status != null
            ? s.staff_status
            : s.status != null
              ? s.status
              : s.user_status != null
                ? s.user_status
                : null,
        pending_tasks: 0,
        total_applications: 0,
      }))
    : [];

  const user = {
    ...baseUser,
    name: staff.staff_names || emailGuess || 'Staff',
    phone: staff.staff_phone || null,
    gender: staff.staff_gender || null,
    personal_email: staff.staff_personal_email || null,
    group: staff.staff_group || null,
    group_id: staff.group_id != null ? staff.group_id : null,
    dutyStation: staff.staff_duty_station || null,
    employmentType: staff.staff_employment_type || null,
    hireDate: staff.staff_hire_date || null,
    endDate: staff.staff_end_date || null,
    degree: staff.staff_degree || null,
    qualifications: staff.staff_qualifications || null,
    nationalId: staff.staff_national_id || null,
    secondmentOrg: staff.staff_secondment_org || null,
    internInstitution: staff.staff_intern_institution || null,
    internEndDate: staff.staff_intern_end_date || null,
    is_self_assign: staff.is_self_assign,
    position: pos?.position_title || null,
    positionGrade: pos?.grade || null,
    contractType: pos?.contract_type || null,
    positionStartDate: pos?.start_date || null,
    orgUnitName: org?.org_unit_name || null,
    orgUnitType: org?.org_unit_type || null,
    orgStartDate: org?.start_date || null,
    parentOrgUnitName: parentOrg?.org_unit_name || null,
    parentOrgUnitType: parentOrg?.org_unit_type || null,
    supervisorId: sup?.staff_id != null ? Number(sup.staff_id) : null,
    reports_to,
    direct_reports,
    subordinates_count: typeof staff.subordinates_count === 'number' ? staff.subordinates_count : direct_reports.length,
    tokenExpiresAt: expiresAt,
  };

  return { user, token: token || null, expiresAt };
}

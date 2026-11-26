'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, ShieldCheck, X } from 'lucide-react';
import AppShell from '../../../components/AppShell';
import Card from '../../../components/Card';
import PageHeader from '../../../components/PageHeader';
import { PermissionGate } from '../../../components/AccessControl';
import { PERMISSION_MODULES, readStoredRoles, saveRoles } from '../../../lib/rbac';

const CRUD_ACTIONS = ['view', 'create', 'edit', 'delete'];
const APPROVAL_ACTIONS = [...CRUD_ACTIONS, 'approve'];

const SIDEBAR_PERMISSION_NAV = [
  { type: 'link', module: { id: 'dashboard', label: 'Dashboard', actions: ['view'] } },
  {
    type: 'group',
    label: 'Retail',
    modules: [
      { id: 'lead-management', label: 'Lead management', actions: APPROVAL_ACTIONS },
      { id: 'applicant-management', label: 'Customer onboarding', actions: CRUD_ACTIONS },
      { id: 'loan-applications', label: 'Retail Loan Application', actions: APPROVAL_ACTIONS },
      { id: 'gold-loan-application', label: 'Gold Loan Application', actions: APPROVAL_ACTIONS },
    ],
  },
  {
    type: 'group',
    label: 'Corporate',
    modules: [
      { id: 'corporate-lead-management', label: 'Lead management', actions: APPROVAL_ACTIONS },
      { id: 'corporate-customer-onboarding', label: 'Customer onboarding', actions: [], disabled: true },
      { id: 'corporate-loan-application', label: 'Retail Loan Application', actions: CRUD_ACTIONS },
    ],
  },
  {
    type: 'group',
    label: 'Eligibility & Sanctioning',
    modules: [
      { id: 'loan-eligibility', label: 'Loan eligibility', actions: ['view', 'create', 'edit', 'approve'] },
    ],
  },
  {
    type: 'group',
    label: 'User management',
    modules: [
      { id: 'user-management', label: 'User creation', actions: CRUD_ACTIONS },
    ],
  },
  {
    type: 'group',
    label: 'Masters',
    modules: [
      { id: 'bank-management', label: 'Product management', actions: CRUD_ACTIONS },
      { id: 'lookup-management', label: 'Lookup', actions: CRUD_ACTIONS },
      { id: 'rule-engine', label: 'Rule engine', actions: CRUD_ACTIONS },
      { id: 'interest-rate-master', label: 'Interest rate master', actions: CRUD_ACTIONS },
      { id: 'gold-rate-master', label: 'Gold rate master', actions: CRUD_ACTIONS },
      { id: 'bank-master', label: 'Bank master', actions: CRUD_ACTIONS },
      { id: 'bank-branch', label: 'Bank branch', actions: CRUD_ACTIONS },
      { id: 'bank-branch-list', label: 'Bank branch list', actions: CRUD_ACTIONS },
    ],
  },
  { type: 'link', module: { id: 'document-management', label: 'Document management', actions: CRUD_ACTIONS } },
  { type: 'link', module: { id: 'reports', label: 'Reports', actions: ['view'] } },
  { type: 'link', module: { id: 'activity-log', label: 'Activity Log', actions: ['view'] } },
  {
    type: 'group',
    label: 'Settings',
    modules: [
      { id: 'role-access', label: 'Roles & access', actions: CRUD_ACTIONS },
      { id: 'profile', label: 'Profile', actions: ['view', 'edit'] },
      { id: 'settings', label: 'Change password', actions: ['view', 'edit'] },
    ],
  },
];

const ALL_PAGE_MODULES = SIDEBAR_PERMISSION_NAV.flatMap((item) =>
  item.type === 'link' ? [item.module] : item.modules
).filter((module) => module.actions.length);

function permissionSlug(label) {
  return label
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const API_PERMISSION_KEY_BY_KEY = Object.fromEntries(
  SIDEBAR_PERMISSION_NAV.flatMap((item) => {
    const modules = item.type === 'link' ? [item.module] : item.modules;
    return modules.flatMap((module) =>
      module.actions.map((action) => {
        const modulePath = item.type === 'group'
          ? `${permissionSlug(item.label)}.${permissionSlug(module.label)}`
          : permissionSlug(module.label);
        return [`${module.id}.${action}`, `${modulePath}.${action}`];
      })
    );
  })
);

const PERMISSION_ID_BY_KEY = {
  'lead-management.view': 1,
  'lead-management.create': 2,
  'lead-management.edit': 3,
  'lead-management.delete': 4,
  'lead-management.approve': 5,
  'applicant-management.view': 6,
  'applicant-management.create': 7,
  'applicant-management.edit': 8,
  'applicant-management.delete': 9,
  'loan-applications.view': 10,
  'loan-applications.create': 11,
  'loan-applications.edit': 12,
  'loan-applications.delete': 13,
  'loan-applications.approve': 14,
  'gold-loan-application.view': 15,
  'gold-loan-application.create': 16,
  'gold-loan-application.edit': 17,
  'gold-loan-application.delete': 18,
  'gold-loan-application.approve': 19,
  'corporate-lead-management.view': 20,
  'corporate-lead-management.create': 21,
  'corporate-lead-management.edit': 22,
  'corporate-lead-management.delete': 23,
  'corporate-lead-management.approve': 24,
  'corporate-loan-application.view': 25,
  'corporate-loan-application.create': 26,
  'corporate-loan-application.edit': 27,
  'corporate-loan-application.delete': 28,
  'loan-eligibility.view': 29,
  'loan-eligibility.create': 30,
  'loan-eligibility.edit': 31,
  'loan-eligibility.approve': 32,
  'user-management.view': 33,
  'user-management.create': 34,
  'user-management.edit': 35,
  'user-management.delete': 36,
  'bank-management.view': 37,
  'bank-management.create': 38,
  'bank-management.edit': 39,
  'bank-management.delete': 40,
  'lookup-management.view': 41,
  'lookup-management.create': 42,
  'lookup-management.edit': 43,
  'lookup-management.delete': 44,
  'rule-engine.view': 45,
  'rule-engine.create': 46,
  'rule-engine.edit': 47,
  'rule-engine.delete': 48,
  'interest-rate-master.view': 49,
  'interest-rate-master.create': 50,
  'interest-rate-master.edit': 51,
  'interest-rate-master.delete': 52,
  'gold-rate-master.view': 53,
  'gold-rate-master.create': 54,
  'gold-rate-master.edit': 55,
  'gold-rate-master.delete': 56,
  'bank-master.view': 57,
  'bank-master.create': 58,
  'bank-master.edit': 59,
  'bank-master.delete': 60,
  'bank-branch.view': 61,
  'bank-branch.create': 62,
  'bank-branch.edit': 63,
  'bank-branch.delete': 64,
  'bank-branch-list.view': 65,
  'bank-branch-list.create': 66,
  'bank-branch-list.edit': 67,
  'bank-branch-list.delete': 68,
  'document-management.view': 69,
  'document-management.create': 70,
  'document-management.edit': 71,
  'document-management.delete': 72,
  'reports.view': 73,
  'activity-log.view': 74,
  'role-access.view': 75,
  'role-access.create': 76,
  'role-access.edit': 77,
  'role-access.delete': 78,
  'profile.view': 79,
  'profile.edit': 80,
  'settings.view': 81,
  'settings.edit': 82,
  'dashboard.view': 83,
};

function createEmptyPermissions() {
  return Object.fromEntries([
    ...PERMISSION_MODULES.flatMap((module) =>
      module.actions.map((action) => [`${module.id}.${action}`, false])
    ),
    ...ALL_PAGE_MODULES.flatMap((module) =>
      module.actions.map((action) => [`${module.id}.${action}`, false])
    ),
  ]);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function AddRoleForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditing = Boolean(editId);
  const [existingRole, setExistingRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(isEditing);
  const [role, setRole] = useState({
    name: '',
    roleId: 3,
    description: '',
    isSystem: false,
    permissions: createEmptyPermissions(),
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) {
      setExistingRole(null);
      setLoadingRole(false);
      return;
    }

    setLoadingRole(true);
    try {
      const savedRole = readStoredRoles().find((currentRole) => String(currentRole.id) === editId);
      if (!savedRole) {
        setExistingRole(null);
        setFormError('This role could not be found.');
        return;
      }

      setExistingRole(savedRole);
      setRole({
        ...savedRole,
        roleId: savedRole.roleId ?? '',
        name: savedRole.name || '',
        description: savedRole.description || '',
        status: savedRole.status || 'Active',
        permissions: { ...createEmptyPermissions(), ...(savedRole.permissions || {}) },
      });
      setFormError('');
    } catch (error) {
      setExistingRole(null);
      setFormError(error instanceof Error ? error.message : 'Unable to load the saved role.');
    } finally {
      setLoadingRole(false);
    }
  }, [editId]);

  const setPermission = (key, checked) => {
    setRole((current) => ({
      ...current,
      permissions: { ...current.permissions, [key]: checked },
    }));
  };

  const setModulePermissions = (module, checked) => {
    setRole((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        ...Object.fromEntries(module.actions.map((action) => [`${module.id}.${action}`, checked])),
      },
    }));
  };

  const clearAllPermissions = () => {
    setRole((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        ...Object.fromEntries(
          ALL_PAGE_MODULES.flatMap((module) =>
            module.actions.map((action) => [`${module.id}.${action}`, false])
          )
        ),
      },
    }));
  };

  const submitRole = (event) => {
    event.preventDefault();
    if (saving) return;

    const name = role.name.trim();
    const description = role.description.trim();
    if (!name) {
      setFormError('Enter a role name.');
      return;
    }
    if (!description) {
      setFormError('Enter a description for this role.');
      return;
    }

    const roleId = isEditing ? existingRole?.roleId : Number(role.roleId);
    if (!isEditing && (!Number.isSafeInteger(roleId) || roleId < 1)) {
      setFormError('Enter a valid positive role ID.');
      return;
    }
    if (isEditing && !existingRole) {
      setFormError('The role could not be loaded for editing.');
      return;
    }

    setSaving(true);
    try {
      const currentRoles = readStoredRoles();
      if (currentRoles.some((currentRole) =>
        normalize(currentRole.name) === normalize(name) && currentRole.id !== existingRole?.id
      )) {
        setFormError('A role with this name already exists.');
        return;
      }
      if (!isEditing && currentRoles.some((currentRole) => Number(currentRole.roleId) === roleId)) {
        setFormError('A role with this ID already exists.');
        return;
      }

      const selectedPermissionKeys = Object.entries(role.permissions)
        .filter(([, selected]) => selected)
        .map(([permissionKey]) => permissionKey);
      const missingPermissionId = selectedPermissionKeys.find(
        (permissionKey) => !Object.prototype.hasOwnProperty.call(PERMISSION_ID_BY_KEY, permissionKey)
      );
      if (missingPermissionId) {
        setFormError(`No permission ID is configured for ${missingPermissionId}.`);
        return;
      }

      const permissionIds = selectedPermissionKeys
        .map((permissionKey) => PERMISSION_ID_BY_KEY[permissionKey])
        .sort((first, second) => first - second);
      const apiPermissions = selectedPermissionKeys.map(
        (permissionKey) => API_PERMISSION_KEY_BY_KEY[permissionKey]
      );
      if (apiPermissions.some((permission) => !permission)) {
        setFormError('A selected permission does not have an API key configured.');
        return;
      }
      const payload = {
        roleId,
        roleName: name,
        description,
        totalSelected: permissionIds.length,
        permissionIds,
        permissions: apiPermissions,
      };

      const updatedRole = {
        ...(existingRole || {}),
        ...role,
        id: existingRole?.id || `CUSTOM_${Date.now()}`,
        name,
        roleId,
        roleName: name,
        totalSelected: payload.totalSelected,
        permissionIds,
        apiPayload: payload,
        status: role.status || existingRole?.status || 'Active',
        updatedAt: new Date().toISOString(),
      };
      saveRoles(isEditing
        ? currentRoles.map((currentRole) => currentRole.id === existingRole.id ? updatedRole : currentRole)
        : [...currentRoles, updatedRole]);
      router.push('/role_access');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the role in browser storage.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PermissionGate
      module="role-access"
      action={isEditing ? 'edit' : 'create'}
      fallback={(
        <Card className="role-create-denied">
          <ShieldCheck size={24} />
          <strong>You don’t have permission to {isEditing ? 'edit' : 'create'} roles.</strong>
          <Link href="/role_access">Return to Roles &amp; access</Link>
        </Card>
      )}
    >
      <main className="role-create-page">
        <PageHeader
          title={isEditing ? 'Edit Role' : 'Add Role'}
          action={(
            <Link href="/role_access" className="role-back-link">
              <ArrowLeft size={18} /> Back to roles
            </Link>
          )}
        />

        <Card className="role-create-card">
          {loadingRole && <p role="status">Loading role…</p>}
          <form onSubmit={submitRole}>
            <div className="role-create-fields">
              <label>
                <span>Role name <b>*</b></span>
                <input
                  value={role.name}
                  onChange={(event) => setRole((current) => ({ ...current, name: event.target.value }))}
                  maxLength={60}
                  required
                  placeholder="e.g. Loan Reviewer"
                />
              </label>
              {!isEditing && (
                <label>
                  <span>Role ID <b>*</b></span>
                  <input
                    type="number"
                    value={role.roleId}
                    onChange={(event) => setRole((current) => ({ ...current, roleId: event.target.value }))}
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 3"
                  />
                </label>
              )}
              <label>
                <span>Description <b>*</b></span>
                <textarea
                  value={role.description}
                  onChange={(event) => setRole((current) => ({ ...current, description: event.target.value }))}
                  maxLength={240}
                  rows={3}
                  required
                  placeholder="Describe the role’s responsibilities"
                />
              </label>
              {isEditing && (
                <label>
                  <span>Status</span>
                  <select
                    value={role.status || 'Active'}
                    onChange={(event) => setRole((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
              )}
            </div>

            <section className="role-access-permissions" aria-labelledby="role-permissions-title">
              <div className="role-permissions-heading">
                <div>
                  <span className="role-section-eyebrow">PERMISSIONS</span>
                  <h2 id="role-permissions-title">Module permissions</h2>
                  <p>Choose the actions permitted for each module.</p>
                </div>
                <div className="role-bulk-actions">
                  <button type="button" onClick={clearAllPermissions}>
                    <X size={14} /> Clear all
                  </button>
                </div>
              </div>

              <div className="role-sidebar-sections">
                {SIDEBAR_PERMISSION_NAV.map((item) => {
                  const modules = item.type === 'link' ? [item.module] : item.modules;
                  return (
                    <section className="role-sidebar-section" key={item.type === 'link' ? item.module.id : item.label}>
                      {item.type === 'group' && <h3>{item.label}</h3>}
                      <div className="role-permission-list">
                        {modules.map((module) => {
                          if (module.disabled) {
                            return (
                              <div className="role-disabled-module" key={module.id}>
                                <strong>{module.label}</strong>
                                <span>Unavailable</span>
                              </div>
                            );
                          }

                          const selectedCount = module.actions.filter(
                            (action) => role.permissions[`${module.id}.${action}`]
                          ).length;
                          const allSelected = selectedCount === module.actions.length;

                          return (
                            <div
                              className="role-permission-module"
                              key={module.id}
                              role="group"
                              aria-labelledby={`permission-module-${module.id}`}
                            >
                              <div className="role-permission-module-header">
                                <label className="role-module-title">
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(element) => {
                                      if (element) element.indeterminate = selectedCount > 0 && !allSelected;
                                    }}
                                    onChange={(event) => setModulePermissions(module, event.target.checked)}
                                    aria-label={`Select all ${module.label} permissions`}
                                  />
                                  <strong id={`permission-module-${module.id}`}>{module.label}</strong>
                                </label>
                                <span className="role-permission-count">{selectedCount}/{module.actions.length}</span>
                              </div>
                              <div className="role-action-checkboxes">
                                {module.actions.map((action) => {
                                  const key = `${module.id}.${action}`;
                                  return (
                                    <label key={key}>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(role.permissions[key])}
                                        onChange={(event) => setPermission(key, event.target.checked)}
                                      />
                                      <span>{action.charAt(0).toUpperCase() + action.slice(1)}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>

            {formError && <p className="role-form-error" role="alert">{formError}</p>}
            <footer className="role-create-footer">
              <Link href="/role_access" className="secondary-button">Cancel</Link>
              <button type="submit" className="primary-button" disabled={saving || loadingRole || (isEditing && !existingRole)}>
                <Check size={15} /> {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Role'}
              </button>
            </footer>
          </form>
        </Card>
      </main>

      <style jsx>{`
        .role-create-page { padding-bottom: 24px; }
        :global(.page-header .role-back-link) { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0; color: #000; border: 0; background: transparent; font-size: 15px; font-weight: 700; }
        :global(.page-header .role-back-link:hover) { color: #000; background: transparent; text-decoration: underline; }
        :global(.role-create-card) { padding: 20px; border-color: #d6e0e0; border-radius: 10px; }
        .role-create-fields { display: grid; max-width: 420px; gap: 12px; }
        .role-create-fields label { display: grid; gap: 7px; color: #52696c; font-size: 12px; font-weight: 700; }
        .role-create-fields label b { color: #bd6a52; }
        .role-create-fields input, .role-create-fields textarea, .role-create-fields select { width: 100%; padding: 9px 11px; color: #345256; border: 1px solid #d8e2e1; border-radius: 6px; outline: none; background: #fff; font: 14px 'DM Sans', sans-serif; }
        .role-create-fields input, .role-create-fields select { height: 40px; }
        .role-create-fields textarea { resize: vertical; }
        .role-create-fields input:focus, .role-create-fields textarea:focus, .role-create-fields select:focus { border-color: #177e7a; box-shadow: 0 0 0 3px rgba(23,126,122,.08); }
        .role-access-permissions { margin-top: 24px; }
        .role-permissions-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; margin: 0 0 12px; }
        .role-section-eyebrow { color: #89999a; font-size: 10px; font-weight: 700; letter-spacing: 1.1px; }
        .role-permissions-heading h2 { margin: 4px 0 0; color: #315357; font: 700 18px Manrope, sans-serif; }
        .role-permissions-heading p { margin: 5px 0 0; color: #89999a; font-size: 12px; }
        .role-bulk-actions { display: flex; gap: 10px; }
        .role-bulk-actions button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; color: #247976; border: 1px solid #cddbd9; border-radius: 6px; background: #fff; font-size: 12px; font-weight: 700; white-space: nowrap; transition: background .15s ease, color .15s ease, border-color .15s ease; }
        .role-bulk-actions button:hover { color: #fff; border-color: #238a57; background: #238a57; }
        .role-sidebar-sections { display: grid; gap: 14px; }
        .role-sidebar-section { display: grid; gap: 10px; padding: 14px; border: 1px solid #b9d8d1; border-radius: 9px; background: #e3efec; }
        .role-sidebar-section > h3 { margin: 0; color: #315357; font: 700 15px Manrope, sans-serif; }
        .role-permission-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .role-permission-module { display: grid; min-width: 0; gap: 8px; margin: 0; padding: 10px 12px; border: 1px solid #cedbd8; border-radius: 8px; background: #fff; }
        .role-permission-module-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .role-module-title { display: inline-flex; align-items: center; gap: 8px; min-width: 0; color: #345256; font-size: 13px; cursor: pointer; }
        .role-module-title strong { overflow-wrap: anywhere; }
        .role-permission-count { flex: 0 0 auto; color: #75898b; font-size: 11px; }
        .role-permission-module input { width: 16px; height: 16px; flex: 0 0 auto; accent-color: #177e7a; }
        .role-disabled-module { display: flex; min-height: 64px; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; color: #718589; border: 1px dashed #b9d8d1; border-radius: 8px; background: transparent; font-size: 12px; }
        .role-disabled-module span { font-size: 11px; }
        .role-action-checkboxes { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 0 0 0 24px; }
        .role-action-checkboxes label { display: inline-flex; align-items: center; gap: 6px; color: #63777a; font-size: 11px; cursor: pointer; }
        .role-form-error { margin: 14px 0 0; color: #ae5148; font-size: 13px; }
        .role-create-footer { display: flex; justify-content: flex-end; gap: 9px; margin: 18px -20px -20px; padding: 12px 20px; border-top: 1px solid #d9e3e3; background: #fff; }
        .role-create-footer :global(button), .role-create-footer :global(a) { display: inline-flex; height: 38px; align-items: center; justify-content: center; }
        .role-create-footer :global(.primary-button) { color: #fff; border: 1px solid #238a57; background: #238a57; box-shadow: none; }
        .role-create-footer :global(.primary-button:hover) { border-color: #176b43; background: #176b43; }
        .role-create-denied { display: grid; justify-items: center; gap: 10px; padding: 30px; color: #536d70; text-align: center; }
        .role-create-denied :global(svg) { color: #45817b; }
        .role-create-denied a { color: #247976; font-size: 11px; font-weight: 700; }
        @media (max-width: 720px) {
          :global(.page-header) { align-items: flex-start; flex-direction: column; }
          :global(.role-create-card) { padding: 16px; }
          .role-permission-list { grid-template-columns: 1fr; }
          .role-create-footer { margin-right: -16px; margin-bottom: -16px; margin-left: -16px; padding-right: 16px; padding-left: 16px; }
        }
        @media (max-width: 420px) {
          .role-permissions-heading { align-items: flex-start; flex-direction: column; }
          .role-create-footer { justify-content: stretch; }
          .role-create-footer :global(button), .role-create-footer :global(a) { flex: 1; }
        }
      `}</style>
    </PermissionGate>
  );
}

export default function AddRolePage() {
  return (
    <AppShell title="Role & Access Management">
      <Suspense fallback={<div role="status">Loading role form…</div>}>
        <AddRoleForm />
      </Suspense>
    </AppShell>
  );
}
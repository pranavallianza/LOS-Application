'use client';

import AppShell from '../../../components/AppShell';
import UserForm from '../../../components/UserForm';

export default function AddUserPage() {
  return (
    <AppShell title="Add User">
      <div className="user-management-page">
        <UserForm mode="add" />
      </div>
    </AppShell>
  );
}


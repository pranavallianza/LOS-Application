'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Edit3,
  Lock,
  Shield,
  User,
  AlertCircle,
} from 'lucide-react';

import AppShell from '../../../../components/AppShell';
import PageHeader from '../../../../components/PageHeader';
import Card from '../../../../components/Card';
import { getUserById, normalizeUserRecord } from '../../../../services/user_management';

export default function ViewUserPage() {
  const router = useRouter();
  const routeParams = useParams();
  const resolvedId = routeParams?.id;

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadEmployee = async () => {
      if (!resolvedId) {
        setLoading(false);
        return;
      }

      try {
        const user = await getUserById(resolvedId);
        if (!cancelled) setEmployee(normalizeUserRecord(user || {}));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load user details.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadEmployee();
    return () => {
      cancelled = true;
    };
  }, [resolvedId]);

  if (loading) {
    return (
      <AppShell title="Employee Details">
        <div className="employee-details-page" style={{ padding: '60px 0', textAlign: 'center', color: '#7a8e91' }}>
          Loading employee details...
        </div>
      </AppShell>
    );
  }

  if (error || !employee) {
    return (
      <AppShell title="Employee Not Found">
        <div className="employee-details-page">
          <Card style={{ padding: '36px', textAlign: 'center', maxWidth: '560px', margin: '40px auto' }}>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#dc2626',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AlertCircle size={26} />
            </div>
            <h2 style={{ fontSize: '18px', color: '#173e46', margin: '0 0 8px' }}>
              Employee Record Not Found
            </h2>
            <p style={{ color: '#7a8e91', fontSize: '13px', margin: '0 0 24px' }}>
              {error || 'The requested employee identifier could not be located in the directory.'}
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => router.push('/user_management')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <ArrowLeft size={16} />
              Return to User Management
            </button>
          </Card>
        </div>
      </AppShell>
    );
  }

  const fullName = employee.name || employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
  const empId = employee.empNo || employee.employeeId;

  return (
    <AppShell title={`Employee: ${fullName}`}>
      <div className="employee-details-page">
        <PageHeader
          eyebrow="EMPLOYEE DIRECTORY"
          title={fullName}
          description={`Emp ID: ${empId} • Designation: ${employee.designation || 'Staff'} • Branch: ${employee.branch || employee.loginBranch || 'Head Office'}`}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => router.push('/user_management')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => router.push(`/user_management/edit/${employee.id ?? empId}`)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Edit3 size={15} />
                Edit Employee
              </button>
            </div>
          }
        />

        <div
          className="form-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
            background: 'linear-gradient(180deg, #ffffff 0%, #f9fbfb 100%)',
            border: '1px solid #dce6e5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                background: '#e0eeea',
                color: '#167c78',
                display: 'grid',
                placeItems: 'center',
                fontSize: '20px',
                fontWeight: 800,
              }}
            >
              {fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: '#173e46' }}>{fullName}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#6a7e82' }}>
                <span>@{employee.userName}</span>
                <span>•</span>
                <span className="role-badge">{employee.userRole || employee.role || 'Staff'}</span>
                <span>•</span>
                <span className={`status ${employee.status === 'Active' ? 'status-green' : employee.status === 'Suspended' ? 'status-amber' : 'status-grey'}`}>
                  {employee.status}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#7a8e91', display: 'block' }}>Branch</span>
              <strong style={{ fontSize: '13px', color: '#173e46' }}>{employee.branch || employee.loginBranch || 'Head Office'}</strong>
            </div>
            <div style={{ height: '32px', width: '1px', background: '#e1e9e8' }} />
            <div>
              <span style={{ fontSize: '11px', color: '#7a8e91', display: 'block' }}>Last Login</span>
              <strong style={{ fontSize: '13px', color: '#173e46' }}>{employee.lastLogin || 'Never'}</strong>
            </div>
          </div>
        </div>

        <div className="employee-details-grid">
          <div className="form-card" style={{ marginBottom: 0 }}>
            <div className="form-card-title"><User size={18} color="#167c78" /><span>Employee and Personal Information</span></div>
            <div style={{ display: 'grid', gap: '14px' }}>
              {[['Emp ID', empId], ['First Name', employee.firstName || '-'], ['Middle Name', employee.middleName || '-'], ['Last Name', employee.lastName || '-'], ['Mobile Number', employee.mobile || '-'], ['Date of Birth', employee.dateOfBirth || '-']].map(([label, value], index, arr) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: index === arr.length - 1 ? 'none' : '1px solid #f1f5f4' }}>
                  <span style={{ fontSize: '12px', color: '#6a7e82' }}>{label}</span>
                  <strong style={{ fontSize: '13px', color: '#173e46' }}>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="form-card" style={{ marginBottom: 0 }}>
            <div className="form-card-title"><Lock size={18} color="#167c78" /><span>Login Information</span></div>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f4' }}>
                <span style={{ fontSize: '12px', color: '#6a7e82' }}>User Name</span>
                <strong style={{ fontSize: '13px', color: '#167c78' }}>{employee.userName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f4' }}>
                <span style={{ fontSize: '12px', color: '#6a7e82' }}>Email Address</span>
                <strong style={{ fontSize: '13px', color: '#173e46' }}>{employee.email || '-'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f4' }}>
                <span style={{ fontSize: '12px', color: '#6a7e82' }}>Password</span>
                <span style={{ fontSize: '13px', color: '#88999a', letterSpacing: '2px' }}>••••••••••••</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: '12px', color: '#6a7e82' }}>Account State</span>
                <strong style={{ fontSize: '13px', color: '#173e46' }}>{employee.status}</strong>
              </div>
            </div>
          </div>

          <div className="form-card" style={{ marginBottom: 0 }}>
            <div className="form-card-title"><Shield size={18} color="#167c78" /><span>Role and Access Information</span></div>
            <div style={{ display: 'grid', gap: '14px' }}>
              {[['Designation', employee.designation || 'Staff'], ['User Role', employee.userRole || employee.role || '-'], ['System Role', employee.systemRole || '-'], ['Login Branch', employee.loginBranch || employee.branch || 'Head Office']].map(([label, value], index, arr) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: index === arr.length - 1 ? 'none' : '1px solid #f1f5f4' }}>
                  <span style={{ fontSize: '12px', color: '#6a7e82' }}>{label}</span>
                  <strong style={{ fontSize: '13px', color: '#173e46' }}>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="form-card" style={{ marginBottom: 0 }}>
            <div className="form-card-title"><Clock size={18} color="#167c78" /><span>Session and Login Settings</span></div>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f4' }}>
                <span style={{ fontSize: '12px', color: '#6a7e82' }}>Permitted Login Time</span>
                <strong style={{ fontSize: '13px', color: '#173e46' }}>{employee.loginTime || '09:00:00'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: '12px', color: '#6a7e82' }}>Permitted LogOut Time</span>
                <strong style={{ fontSize: '13px', color: '#173e46' }}>{employee.logoutTime || '18:00:00'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '28px', marginBottom: '40px' }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => router.push('/user_management')}
            aria-label="Back to User Management"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 20px' }}
          >
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>
    </AppShell>
  );
}

import { profileApi } from '../api';
import { useQuery } from '../components/useQuery';
import './Profile.css';

export default function Profile() {
  const { data: profile, loading, error } = useQuery(profileApi.get);

  if (loading) return <div className="page-loading">Loading profile…</div>;
  if (error) return <div className="page-error">Failed to load profile. {error}</div>;
  if (!profile) return null;

  const fields = [
    { label: 'Full name', value: profile.name },
    { label: 'Email', value: profile.email },
    { label: 'Personal email', value: profile.personal_email },
    { label: 'Role / Access', value: profile.role },
    { label: 'Department / Duty station', value: profile.department },
    { label: 'Phone', value: profile.phone },
    { label: 'Degree', value: profile.degree },
    { label: 'Qualifications', value: profile.qualifications },
    { label: 'Hire date', value: profile.hire_date ? new Date(profile.hire_date).toLocaleDateString() : null },
    { label: 'Staff group', value: profile.staff_group },
  ];

  return (
    <div className="profile-page">
      <div className="profile-card card">
        <div className="profile-header">
          <div className="profile-avatar">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              <span>{profile.name?.slice(0, 2).toUpperCase() || 'RF'}</span>
            )}
          </div>
          <div className="profile-meta">
            <h2>{profile.name}</h2>
            <p className="profile-role">{profile.role || 'Staff'} • {profile.department || 'Rwanda FDA'}</p>
          </div>
        </div>
        <dl className="profile-fields">
          {fields.map(({ label, value }) => (
            <div key={label} className="profile-field">
              <dt>{label}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

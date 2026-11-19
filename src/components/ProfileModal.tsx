import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { UserAccount } from '../types';
import { BeltMark, UserAvatar } from './BeltMark';

interface ProfileModalProps {
  user: UserAccount;
  onClose: () => void;
  onUpdated: (user: UserAccount) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onUpdated }) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');
  const [emergencyContact, setEmergencyContact] = useState(user.studentProfile?.emergency_contact || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 240;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
        setAvatarUrl(compressedDataUrl);
        setError('');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (name.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch<{ user: UserAccount }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          bio: bio.trim(),
          emergencyContact: emergencyContact.trim(),
          avatarUrl,
          currentPassword: newPassword ? currentPassword : undefined,
          newPassword: newPassword || undefined,
        }),
      });
      onUpdated(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setSuccess('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div>
            <h2 id="profile-modal-title" className="font-display text-lg font-bold text-[#111317]">
              Account & Profile Settings
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {user.email} · {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#6B7280] hover:text-[#111317] rounded-lg hover:bg-[#F3F4F6] transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar Upload Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-5 border-b border-[#E5E7EB]">
            <UserAvatar name={name || user.name} avatarUrl={avatarUrl} size="xl" />
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-[#111317] text-white rounded-lg hover:bg-[#272A30] transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Profile Photo</span>
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="px-3 py-2 text-xs font-medium text-[#6B7280] hover:text-[#C81E2B] transition-colors"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
              <p className="text-xs text-[#6B7280]">Square JPEG/PNG cropped automatically for your dojang pass.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </div>

          {user.studentProfile && (
            <div className="flex items-center justify-between py-2.5 px-3.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg">
              <span className="text-xs font-medium text-[#6B7280]">Current Belt Rank</span>
              <BeltMark colorHex={user.studentProfile.belt_color} beltName={user.studentProfile.belt_name} size="sm" />
            </div>
          )}

          {error && <div className="p-3 text-sm bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg">{error}</div>}
          {success && <div className="p-3 text-sm bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] rounded-lg">{success}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="prof-name">
                Full Name
              </label>
              <input
                id="prof-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#C81E2B]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="prof-phone">
                Phone Number
              </label>
              <input
                id="prof-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#C81E2B]"
              />
            </div>
          </div>

          {user.role === 'student' && (
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="prof-emergency">
                Emergency Contact
              </label>
              <input
                id="prof-emergency"
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Contact Name · Phone Number"
                className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#C81E2B]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5" htmlFor="prof-bio">
              Training Bio & Goals
            </label>
            <textarea
              id="prof-bio"
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#C81E2B]"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E7EB]">
            <p className="text-xs font-semibold text-[#111317] mb-3">Change Password (Optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1" htmlFor="prof-cur-pw">
                  Current Password
                </label>
                <input
                  id="prof-cur-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#C81E2B]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B7280] mb-1" htmlFor="prof-new-pw">
                  New Password
                </label>
                <input
                  id="prof-new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#C81E2B]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#4B5563] hover:text-[#111317] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold bg-[#C81E2B] hover:bg-[#A61722] text-white rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

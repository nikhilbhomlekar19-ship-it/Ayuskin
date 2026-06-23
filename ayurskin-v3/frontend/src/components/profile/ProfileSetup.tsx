import React, { useState, useEffect } from 'react';
import { profileApi } from '../../services/api';

interface Props { onClose: () => void; }

export default function ProfileSetup({ onClose }: Props) {
  const [age,      setAge]      = useState('');
  const [gender,   setGender]   = useState('');
  const [skinType, setSkinType] = useState('');
  const [city,     setCity]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Pre-load existing profile
  useEffect(() => {
    profileApi.get().then(p => {
      if (p.age)      setAge(String(p.age));
      if (p.gender)   setGender(p.gender);
      if (p.skinType) setSkinType(p.skinType);
      if (p.city)     setCity(p.city);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      await profileApi.update({
        age:      age ? parseInt(age) as any : undefined,
        gender:   gender   as any || undefined,
        skinType: skinType as any || undefined,
        city:     city     || undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card profile-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🌿 Complete Your Profile</h2>
          <p>Personalize your Ayurvedic skincare recommendations</p>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="profile-form">
          <div className="form-row">
            <div className="form-group">
              <label>Age</label>
              <input
                type="number" min="10" max="100"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="e.g. 24"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Mumbai"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Gender</label>
            <div className="option-btns">
              {['male','female','other','prefer_not'].map(g => (
                <button
                  key={g}
                  className={`option-btn ${gender === g ? 'active' : ''}`}
                  onClick={() => setGender(g)}
                >
                  {g === 'prefer_not' ? 'Prefer not to say' : g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Skin Type</label>
            <div className="option-btns">
              {[
                { val: 'oily',        emoji: '💧', desc: 'Shiny T-zone, prone to acne' },
                { val: 'dry',         emoji: '🏜️',  desc: 'Tight feeling, flaking' },
                { val: 'combination', emoji: '⚖️',  desc: 'Oily T-zone, dry cheeks' },
                { val: 'normal',      emoji: '✨',  desc: 'Balanced, no major issues' },
              ].map(({ val, emoji, desc }) => (
                <button
                  key={val}
                  className={`option-btn skin-type-btn ${skinType === val ? 'active' : ''}`}
                  onClick={() => setSkinType(val)}
                >
                  <span className="type-emoji">{emoji}</span>
                  <span className="type-name">{val.charAt(0).toUpperCase() + val.slice(1)}</span>
                  <span className="type-desc">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="error-banner">⚠️ {error}</div>}

          <div className="profile-actions">
            <button className="skip-btn" onClick={onClose}>Skip for now</button>
            <button className="save-btn" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : '✓ Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { INFO_CONTENT } from './infoContent';

export function InformationPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="info-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="info-dialog" role="dialog" aria-modal="true" aria-labelledby="info-title">
      <header className="info-dialog-header"><div className="info-dialog-icon"><Info size={17} /></div><div><h2 id="info-title">About Complex Studio</h2><span>Version {INFO_CONTENT.version}</span></div><button className="icon-btn" aria-label="Close information" onClick={onClose}><X size={16} /></button></header>
      <div className="info-dialog-content">
        <p>{INFO_CONTENT.about}</p>
        <section><h3>Publisher</h3><p>{INFO_CONTENT.publisher}</p></section>
        <section><h3>Announcements</h3><ul>{INFO_CONTENT.announcements.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h3>Patch notes</h3><ul>{INFO_CONTENT.patchNotes.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h3>Acknowledgements</h3><ul>{INFO_CONTENT.acknowledgements.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h3>Known issues</h3><ul>{INFO_CONTENT.knownIssues.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h3>Credits</h3><ul>{INFO_CONTENT.credits.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </div>
    </section>
  </div>;
}

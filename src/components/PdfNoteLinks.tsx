import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';
import type { LessonNote, Role } from '../../shared/domain';
import { api } from '../api';

export function PdfNoteLinks({ role, partnerId, note }: {
  role: Role;
  partnerId: string;
  note: LessonNote;
}) {
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(true);
  const pdf = note.pdf;

  useEffect(() => {
    if (!pdf) return;
    let disposed = false;
    let objectUrl = '';
    setUrl('');
    setProblem('');
    setLoading(true);
    void api.getNotePdf(role, partnerId, note.id).then(blob => {
      if (disposed) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(error => {
      if (!disposed) setProblem((error as Error).message);
    }).finally(() => {
      if (!disposed) setLoading(false);
    });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [role, partnerId, note.id, pdf?.id]);

  if (!pdf) return null;
  return <div className="classroom-pdf-attachment">
    <span className="classroom-pdf-icon"><FileText size={24}/></span>
    <div className="classroom-pdf-info">
      <strong>{pdf.name}</strong>
      <small>PDF · {(pdf.sizeBytes / (1024 * 1024)).toFixed(2)} MB</small>
      {loading && <small role="status">Loading PDF from this browser…</small>}
      {problem && <small role="alert" className="classroom-pdf-error">{problem}</small>}
    </div>
    {url && <div className="classroom-pdf-links">
      <a className="secondary-button" href={url} target="_blank" rel="noopener noreferrer" aria-label={'Open PDF ' + pdf.name}><ExternalLink size={15}/> View</a>
      <a className="secondary-button" href={url} download={pdf.name} aria-label={'Download PDF ' + pdf.name}><Download size={15}/> Download</a>
    </div>}
  </div>;
}

import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';
import type { Homework, PdfNoteAttachment, Role } from '../../shared/domain';
import { api } from '../api';

/** PDF viewer/downloader for teacher worksheets and student answer sheets.
 * The blob is retrieved through the matched classroom service for the current identity. */
export function PdfHomeworkLinks({ role, partnerId, homework, kind }: {
  role: Role;
  partnerId: string;
  homework: Homework;
  kind: 'assignment' | 'submission';
}) {
  const pdf: PdfNoteAttachment | undefined = kind === 'assignment'
    ? homework.assignmentPdf : homework.submissionPdf;
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let objectUrl = '';
    setUrl('');
    setProblem('');
    setLoading(true);
    void api.getHomeworkPdf(role, partnerId, homework.id, kind).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(cause => {
      if (!cancelled) setProblem((cause as Error).message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [role, partnerId, homework.id, kind, pdf?.id]);

  if (!pdf) return null;
  const label = kind === 'assignment' ? 'Teacher worksheet' : 'Student answer sheet';
  return <div className="classroom-pdf-attachment">
    <span className="classroom-pdf-icon"><FileText size={24}/></span>
    <div className="classroom-pdf-info">
      <strong>{label}: {pdf.name}</strong>
      <small>PDF · {(pdf.sizeBytes / (1024 * 1024)).toFixed(2)} MB</small>
      {loading && <small role="status">Loading PDF from this browser…</small>}
      {problem && <small role="alert" className="classroom-pdf-error">{problem}</small>}
    </div>
    {url && <div className="classroom-pdf-links">
      <a className="secondary-button" href={url} target="_blank" rel="noopener noreferrer" aria-label={'View ' + label + ' PDF ' + pdf.name}><ExternalLink size={15}/> View</a>
      <a className="secondary-button" href={url} download={pdf.name} aria-label={'Download ' + label + ' PDF ' + pdf.name}><Download size={15}/> Download</a>
    </div>}
  </div>;
}

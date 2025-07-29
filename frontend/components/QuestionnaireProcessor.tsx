import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, Download, FileUp } from 'lucide-react';
import api from '../utils/api';

interface Result {
  question: string;
  answer: string;
  source_file: string;
  source_paragraph: string;
}

interface Props {
  orgId: string;
}

export default function QuestionnaireProcessor({ orgId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [downloading, setDownloading] = useState<null | 'docx' | 'pdf'>(null);
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ];

  const handleProcess = async () => {
    if (!file || !allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type');
      return;
    }
    setProcessing(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post(`/questionnaire/process/${orgId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('Process response', data);
      setResults(data.results);
      toast.success('✅ Processed questionnaire');
    } catch (err: any) {
      console.error('Process error', err);
      toast.error('Failed to process questionnaire');
    } finally {
      setProcessing(false);
    }
  };

  const download = async (format: 'docx' | 'pdf') => {
    if (!results) {
      toast.error('No processed results');
      return;
    }
    setDownloading(format);
    try {
      const res = await api.post(`/questionnaire/process/${orgId}/${format}`, results, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `answers.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error', err);
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 p-6 rounded-xl shadow border border-gray-200 dark:border-zinc-700">
      <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Questionnaire Answer Processor</h1>
      <div className="space-y-4">
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
        />
        {file && (
          <button
            onClick={handleProcess}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} 
            {processing ? 'Processing...' : 'Process'}
          </button>
        )}
      </div>

      {results && (
        <div className="mt-6 space-y-6">
          {results.map((r, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
              <p className="font-semibold text-gray-800 dark:text-gray-100">{r.question}</p>
              <p className="mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-line">{r.answer}</p>
              {r.source_file && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Source: {r.source_file} - Paragraph: "{r.source_paragraph}"
                </p>
              )}
            </div>
          ))}

          <div className="flex gap-4">
            <button
              onClick={() => download('docx')}
              disabled={downloading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
            >
              {downloading === 'docx' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}{' '}
              {downloading === 'docx' ? 'Generating...' : 'DOCX'}
            </button>
            <button
              onClick={() => download('pdf')}
              disabled={downloading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-50"
            >
              {downloading === 'pdf' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}{' '}
              {downloading === 'pdf' ? 'Generating...' : 'PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
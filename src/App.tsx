/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, Trash2, Smartphone, Info, QrCode, Share2, Circle, Check, CheckCircle, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';

interface FileItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  downloadUrl?: string;
  error?: string;
  selected?: boolean;
}

// Force refresh v45
export default function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [showInstallInfo, setShowInstallInfo] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  const [noteStyle, setNoteStyle] = useState<'plain' | 'lines' | 'dotted'>(() => {
    const saved = localStorage.getItem('wide-pdf-style');
    return (saved as any) || 'plain';
  });
  
  // Load initial values from localStorage or use defaults
  const [spacing, setSpacing] = useState(() => {
    const saved = localStorage.getItem('wide-pdf-spacing');
    return saved ? parseInt(saved) : 20;
  });
  
  const [widthMultiplier, setWidthMultiplier] = useState(() => {
    const saved = localStorage.getItem('wide-pdf-multiplier');
    return saved ? parseFloat(saved) : 1;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Save values to localStorage when they change
  React.useEffect(() => {
    localStorage.setItem('wide-pdf-style', noteStyle);
  }, [noteStyle]);

  React.useEffect(() => {
    localStorage.setItem('wide-pdf-spacing', spacing.toString());
  }, [spacing]);

  React.useEffect(() => {
    localStorage.setItem('wide-pdf-multiplier', widthMultiplier.toString());
  }, [widthMultiplier]);

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const appUrl = 'https://wide-pdf.vercel.app';

  const addFilesToProcess = useCallback((newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length > 0) {
      const newFileItems: FileItem[] = pdfFiles.map(f => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        status: 'pending'
      }));
      setFiles(prev => [...prev, ...newFileItems]);
      generateAll(noteStyle, spacing, widthMultiplier, newFileItems);
    }
  }, [noteStyle, spacing, widthMultiplier]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    addFilesToProcess(selectedFiles);
  };

  // Handle URL Import
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const importId = params.get('id');

    if (importId) {
      const fetchFile = async () => {
        try {
          const response = await fetch(`/api/file?id=${importId}`);
          if (!response.ok) throw new Error('Datei konnte nicht geladen werden oder ist abgelaufen.');
          
          const blob = await response.blob();
          
          // Extract filename from Content-Disposition header
          let fileName = 'imported.pdf';
          const disposition = response.headers.get('Content-Disposition');
          if (disposition && disposition.includes('filename=')) {
            const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
              fileName = filenameMatch[1];
              // Remove Vercel's random suffix if it was added to the filename string itself
              // Vercel suffix is usually a dash followed by random chars before the extension
              fileName = fileName.replace(/-[a-zA-Z0-9]{10,}\.pdf$/i, '.pdf');
            }
          }
          
          const file = new File([blob], fileName, { type: 'application/pdf' });
          
          addFilesToProcess([file]);
          
          // Remove ID from URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        } catch (err) {
          console.error('Import failed:', err);
          setImportError(err instanceof Error ? err.message : 'Import fehlgeschlagen');
        }
      };
      fetchFile();
    }
  }, [addFilesToProcess]);

  const processFile = async (fileItem: FileItem, style: 'plain' | 'lines' | 'dotted', currentSpacing: number, currentMultiplier: number) => {
    setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'processing', error: undefined } : f));

    try {
      const fileArrayBuffer = await fileItem.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(fileArrayBuffer, { ignoreEncryption: true });
      const pdfDoc = await PDFDocument.create();

      const copiedPages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      
      for (const page of copiedPages) {
        const { width: originalWidth, height } = page.getSize();
        const leftMargin = 25; 
        const rightNoteWidth = originalWidth * currentMultiplier;
        const totalWidth = leftMargin + originalWidth + rightNoteWidth;
        
        page.setMediaBox(-leftMargin, 0, totalWidth, height);
        page.setCropBox(-leftMargin, 0, totalWidth, height);
        
        pdfDoc.addPage(page);

        const startX = originalWidth;
        const endX = originalWidth + rightNoteWidth;
        const patternMargin = 8; 

        if (style === 'lines') {
          for (let y = height - 25; y > 25; y -= currentSpacing) {
            page.drawLine({
              start: { x: startX + patternMargin, y: y },
              end: { x: endX - patternMargin, y: y },
              thickness: 0.5,
              color: rgb(0.85, 0.85, 0.85),
            });
          }
        } else if (style === 'dotted') {
          for (let y = height - 25; y > 25; y -= currentSpacing) {
            for (let x = startX + patternMargin; x < endX - patternMargin; x += currentSpacing) {
              page.drawCircle({
                x: x,
                y: y,
                size: 0.5,
                color: rgb(0.7, 0.7, 0.7),
              });
            }
          }
        }

        page.drawLine({
          start: { x: 0, y: 0 },
          end: { x: 0, y: height },
          thickness: 1,
          color: rgb(0.7, 0.7, 0.7),
        });
        
        page.drawLine({
          start: { x: originalWidth, y: 0 },
          end: { x: originalWidth, y: height },
          thickness: 1,
          color: rgb(0.7, 0.7, 0.7),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'completed', downloadUrl: url } : f));
    } catch (err) {
      console.error(err);
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', error: 'Fehler bei der Verarbeitung' } : f));
    }
  };

  const generateAll = async (style: 'plain' | 'lines' | 'dotted' = noteStyle, currentSpacing: number = spacing, currentMultiplier: number = widthMultiplier, targetFiles?: FileItem[]) => {
    setIsProcessingAll(true);
    
    const filesToProcess = targetFiles || files;
    
    for (const fileItem of filesToProcess) {
      await processFile(fileItem, style, currentSpacing, currentMultiplier);
    }
    
    setIsProcessingAll(false);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove?.downloadUrl) {
        URL.revokeObjectURL(fileToRemove.downloadUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const toggleFileSelection = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, selected: !f.selected } : f));
  };

  const shareSelectedFiles = async () => {
    const selectedFiles = files.filter(f => f.selected && f.downloadUrl);
    if (selectedFiles.length === 0) return;

    try {
      const filesToShare: File[] = [];
      for (const item of selectedFiles) {
        const response = await fetch(item.downloadUrl!);
        const blobData = await response.blob();
        const file = new File([blobData], item.file.name.replace(/\.pdf$/i, '') + '_wide.pdf', { type: 'application/pdf' });
        filesToShare.push(file);
      }

      if (navigator.canShare && navigator.canShare({ files: filesToShare })) {
        await navigator.share({
          files: filesToShare,
        });
      } else {
        alert('Teilen wird von diesem Browser nicht unterstützt oder die Dateien sind zu groß.');
      }
    } catch (err) {
      console.error('Sharing failed:', err);
      alert('Teilen fehlgeschlagen.');
    }
  };

  const resetAll = () => {
    files.forEach(f => {
      if (f.downloadUrl) URL.revokeObjectURL(f.downloadUrl);
    });
    setFiles([]);
  };

  const [isOfflineReady, setIsOfflineReady] = useState(false);

  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setIsOfflineReady(true);
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F4] dark:bg-stone-950 text-[#1C1917] dark:text-stone-100 font-sans p-4 md:p-8 flex flex-col items-center justify-center transition-colors duration-200">
      {isOfflineReady && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 right-4 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm border border-stone-200 dark:border-stone-800 px-3 py-1.5 rounded-full flex items-center space-x-2 shadow-sm z-50 transition-colors duration-200"
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Offline bereit</span>
        </motion.div>
      )}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-3xl shadow-xl shadow-stone-200 dark:shadow-none overflow-hidden border border-stone-200 dark:border-stone-800 transition-colors duration-200"
      >
        <div className="p-8 md:p-12">
          <header className="mb-10 flex justify-between items-center">
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 dark:text-white">Wide PDF</h1>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </header>

          <div className="space-y-8">
            {importError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <AlertCircle size={20} />
                  <span className="text-sm font-medium">{importError}</span>
                </div>
                <button onClick={() => setImportError(null)} className="text-xs font-bold hover:underline">Schließen</button>
              </motion.div>
            )}
            <div className="relative group">
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={onFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl p-12 text-center group-hover:border-stone-400 dark:group-hover:border-stone-500 group-hover:bg-stone-50 dark:group-hover:bg-stone-800/50 transition-all duration-300">
                <div className="bg-stone-100 dark:bg-stone-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="text-stone-500 dark:text-stone-400" size={28} />
                </div>
                <p className="text-stone-900 dark:text-white font-medium text-lg">PDFs hier hochladen</p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Notiz-Stil:</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'plain', label: 'Blanko', icon: <div className="w-4 h-4 border border-stone-300 dark:border-stone-600 rounded-sm bg-white dark:bg-stone-800" /> },
                      { id: 'lines', label: 'Liniert', icon: <div className="w-4 h-4 flex flex-col space-y-1">{[1,2,3].map(i=><div key={i} className="h-[1px] bg-stone-300 dark:bg-stone-600 w-full" />)}</div> },
                      { id: 'dotted', label: 'Punktiert', icon: <div className="grid grid-cols-2 gap-1 w-4 h-4">{[1,2,3,4].map(i=><div key={i} className="w-1 h-1 bg-stone-300 dark:bg-stone-600 rounded-full" />)}</div> },
                    ].map((style) => (
                      <button
                        key={style.id}
                        onClick={() => {
                          const newStyle = style.id as any;
                          setNoteStyle(newStyle);
                          generateAll(newStyle, spacing, widthMultiplier);
                        }}
                        className={`flex items-center justify-center space-x-2 py-3 px-2 rounded-xl border-2 transition-all ${
                          noteStyle === style.id 
                            ? 'border-stone-900 bg-stone-900 text-white dark:border-white dark:bg-white dark:text-stone-900' 
                            : 'border-stone-100 bg-stone-50 text-stone-600 hover:border-stone-200 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400 dark:hover:border-stone-700'
                        }`}
                      >
                        {style.icon}
                        <span className="text-sm font-bold">{style.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6 bg-stone-50 dark:bg-stone-950/50 p-6 rounded-2xl border border-stone-100 dark:border-stone-800"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Notiz-Breite: {widthMultiplier}x</label>
                      <span className="text-[10px] text-stone-400 font-mono">1x - 5x</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      step="0.5"
                      value={widthMultiplier}
                      onChange={(e) => {
                        const newMultiplier = parseFloat(e.target.value);
                        setWidthMultiplier(newMultiplier);
                      }}
                      onMouseUp={() => generateAll(noteStyle, spacing, widthMultiplier)}
                      onTouchEnd={() => generateAll(noteStyle, spacing, widthMultiplier)}
                      className="w-full h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-stone-900 dark:accent-white"
                    />
                  </div>

                  {noteStyle !== 'plain' && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Linien-Abstand: {spacing}px</label>
                        <span className="text-[10px] text-stone-400 font-mono">10px - 30px</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="30" 
                        step="1"
                        value={spacing}
                        onChange={(e) => {
                          const newSpacing = parseInt(e.target.value);
                          setSpacing(newSpacing);
                        }}
                        onMouseUp={() => generateAll(noteStyle, spacing, widthMultiplier)}
                        onTouchEnd={() => generateAll(noteStyle, spacing, widthMultiplier)}
                        className="w-full h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-stone-900 dark:accent-white"
                      />
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Deine Dateien ({files.length})</h2>
                  <div className="flex items-center space-x-3">
                    {files.some(f => f.selected && f.status === 'completed') && (
                      <button 
                        onClick={shareSelectedFiles}
                        className="text-xs text-stone-900 dark:text-white hover:underline font-bold flex items-center space-x-1"
                      >
                        <Share2 size={12} />
                        <span>Auswahl teilen</span>
                      </button>
                    )}
                    {files.some(f => f.status === 'completed') && (
                      <button 
                        onClick={() => {
                          const allSelected = files.filter(f => f.status === 'completed').every(f => f.selected);
                          setFiles(prev => prev.map(f => f.status === 'completed' ? { ...f, selected: !allSelected } : f));
                        }}
                        className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white font-medium"
                      >
                        {files.filter(f => f.status === 'completed').every(f => f.selected) ? 'Auswahl aufheben' : 'Alle auswählen'}
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const hasSelection = files.some(f => f.selected);
                        if (hasSelection) {
                          setFiles(prev => {
                            const toRemove = prev.filter(f => f.selected);
                            toRemove.forEach(f => { if (f.downloadUrl) URL.revokeObjectURL(f.downloadUrl); });
                            return prev.filter(f => !f.selected);
                          });
                        } else {
                          resetAll();
                        }
                      }} 
                      className="text-xs text-red-500 hover:underline font-medium"
                    >
                      {files.some(f => f.selected) ? 'Auswahl entfernen' : 'Alle entfernen'}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {files.map((fileItem) => (
                      <motion.div 
                        key={fileItem.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-4 overflow-hidden">
                          {fileItem.status === 'completed' && (
                            <button 
                              onClick={() => toggleFileSelection(fileItem.id)}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                fileItem.selected ? 'bg-stone-900 border-stone-900 dark:bg-white dark:border-white' : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900'
                              }`}
                            >
                              {fileItem.selected && <Check size={14} className="text-white dark:text-stone-900" />}
                            </button>
                          )}
                          <div className={`p-2 rounded-xl text-white shrink-0 ${fileItem.status === 'completed' ? 'bg-green-500 dark:bg-green-600' : fileItem.status === 'error' ? 'bg-red-500 dark:bg-red-600' : 'bg-stone-900 dark:bg-stone-700'}`}>
                            {fileItem.status === 'completed' ? <CheckCircle2 size={20} /> : fileItem.status === 'error' ? <AlertCircle size={20} /> : <FileText size={20} />}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-semibold text-stone-900 dark:text-white truncate text-sm">{fileItem.file.name}</p>
                            <p className="text-stone-400 dark:text-stone-500 text-xs">{(fileItem.file.size / 1024 / 1024).toFixed(2)} MB • {fileItem.status}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {fileItem.status === 'completed' && fileItem.downloadUrl && (
                            <a 
                              href={fileItem.downloadUrl} 
                              download={fileItem.file.name.replace(/\.pdf$/i, '') + '_wide.pdf'}
                              className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                            >
                              <Download size={18} />
                            </a>
                          )}
                          {fileItem.status === 'processing' && (
                            <Loader2 className="animate-spin text-stone-400" size={18} />
                          )}
                          <button 
                            onClick={() => removeFile(fileItem.id)}
                            disabled={fileItem.status === 'processing'}
                            className="p-2 text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {files.length > 0 && files.every(f => f.status === 'completed') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/50 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl flex items-center space-x-3"
              >
                <CheckCircle2 size={20} />
                <span className="text-sm font-medium">Alle PDFs erfolgreich erstellt!</span>
              </motion.div>
            )}
          </div>
        </div>
        
        <footer className="bg-stone-50 dark:bg-stone-950 p-6 border-t border-stone-100 dark:border-stone-800 text-center relative transition-colors duration-200">
          <button 
            onClick={() => setShowInstallInfo(!showInstallInfo)}
            className="inline-flex items-center space-x-2 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors text-sm font-medium"
          >
            <Smartphone size={16} />
            <span>Als App nutzen</span>
          </button>

          <AnimatePresence>
            {showInstallInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 text-left bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 text-sm text-stone-600 dark:text-stone-400 overflow-hidden"
              >
                <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-6">
                  <div className="bg-white dark:bg-stone-800 p-3 border border-stone-100 dark:border-stone-700 rounded-xl shadow-sm shrink-0">
                    <QRCodeSVG value={appUrl} size={140} bgColor={isDarkMode ? '#292524' : '#ffffff'} fgColor={isDarkMode ? '#ffffff' : '#000000'} />
                    <p className="text-[10px] text-stone-400 dark:text-stone-500 text-center mt-2 font-mono uppercase tracking-wider">Scan mit iOS</p>
                  </div>
                  
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center space-x-2 text-stone-900 dark:text-white font-bold mb-1">
                      <Info size={18} />
                      <span>iOS Installation</span>
                    </div>
                    
                    <ol className="list-decimal list-inside space-y-2 ml-1">
                      <li>Scanne den <b>QR-Code</b> links mit deinem iOS-Gerät oder öffne: <br/>
                        <a href={appUrl} target="_blank" rel="noopener noreferrer" className="bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all font-mono">{appUrl}</a>
                      </li>
                      <li>Tippe in Safari auf das <b>Teilen-Symbol</b>.</li>
                      <li>Wähle <b>"Zum Home-Bildschirm"</b> aus.</li>
                      <li>Als <b>Web-App</b> öffnen und auf <b>"Hinzufügen"</b> tippen.</li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </footer>
      </motion.div>
    </div>
  );
}

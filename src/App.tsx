import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Nurse, Patient, TreatmentSession, NURSES, scheduleTreatments } from './lib/scheduler';
import html2pdf from 'html2pdf.js';
import { saveAs } from 'file-saver';
import { 
  Document as DocxDocument, 
  Packer, 
  Paragraph, 
  Table, 
  TableCell, 
  TableRow, 
  WidthType, 
  AlignmentType, 
  VerticalAlign, 
  BorderStyle,
  TextRun
} from 'docx';

import { PatientForm } from './components/PatientForm';
import { format } from 'date-fns';
import { 
  Users, 
  Stethoscope, 
  FileDown, 
  Printer, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Table as TableIcon,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<TreatmentSession[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>(NURSES);
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [bulkInput, setBulkInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Lich_Phun_Khi_Dung_${format(new Date(), 'ddMMyyyy')}`,
  });

  // Load config on mount
  useEffect(() => {
    localStorage.removeItem('hospital_patients'); 
    localStorage.removeItem('hospital_sessions');
    const savedN = localStorage.getItem('hospital_nurses');
    const savedT = localStorage.getItem('hospital_total_patients');
    
    if (savedN) setNurses(JSON.parse(savedN));
    if (savedT) setTotalPatients(parseInt(savedT));
    setPatients([]);
    setSessions([]);
  }, []);

  const updateData = (newPatients: Patient[], currentNurses: Nurse[] = nurses, currentTotal: number = totalPatients) => {
    setPatients(newPatients);
    setSessions(scheduleTreatments(newPatients, currentNurses, currentTotal));
  };

  const updateNurses = (newNurses: Nurse[]) => {
    setNurses(newNurses);
    localStorage.setItem('hospital_nurses', JSON.stringify(newNurses));
    setSessions(scheduleTreatments(patients, newNurses, totalPatients));
  };

  const updateTotalPatients = (val: number) => {
    setTotalPatients(val);
    localStorage.setItem('hospital_total_patients', val.toString());
    setSessions(scheduleTreatments(patients, nurses, val));
  };

  const handleBulkAdd = () => {
    if (!bulkInput.trim()) return;
    setIsLoading(true);
    
    // Process input immediately from bulkInput to avoid stale React closure values
    const lines = bulkInput.trim().split('\n').filter(l => l.trim());
    
    const newPs: Patient[] = lines.map((line, idx) => {
      const parts = line.split(/[,-]/).map(p => p.trim());
      const [name, time, timesStr] = parts;
      const stt = idx + 1;
      return {
        id: Math.random().toString(36).substring(2, 11),
        stt: stt,
        patientId: `BN${String(stt).padStart(3, '0')}`,
        name: name || 'Bệnh nhân chưa tên',
        date: format(new Date(), 'yyyy-MM-dd'),
        orderTime: time || '08:00',
        times: parseInt(timesStr) || 1,
        notes: ''
      };
    });

    setPatients(newPs);
    
    // Simulate a brief calculation delay for smooth premium UX transition,
    // using the exact newly computed separate list.
    setTimeout(() => {
      setSessions(scheduleTreatments(newPs, nurses, totalPatients));
      setBulkInput('');
      setIsLoading(false);
    }, 400);
  };

  const safeFormat = (date: any, fmt: string) => {
    try {
      if (!date) return '--:--';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '--:--';
      return format(d, fmt);
    } catch (e) {
      return '--:--';
    }
  };

  const exportExcel = () => {
    try {
      if (sortedSessions.length === 0) {
        alert('Chưa có dữ liệu để xuất Excel. Vui lòng nhập số bệnh nhân hoặc danh sách và nhấn "CẬP NHẬT".');
        return;
      }
      
      const worksheet = XLSX.utils.json_to_sheet(sortedSessions.map((s, idx) => ({
        'STT': idx + 1,
        'Người bệnh': s.patientName,
        'Lần': `L${s.sessionOrder}`,
        'Y Lệnh': s.orderTime,
        'Bắt đầu': safeFormat(s.startTime, 'HH:mm'),
        'Kết thúc': safeFormat(s.endTime, 'HH:mm'),
        'Điều dưỡng': s.nurseName,
        'Máy': s.machineCode,
        'Ghi chú': ''
      })));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Lịch Khí Dung");
      XLSX.writeFile(workbook, `Lich_Phun_Khi_Dung_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    } catch (error) {
      console.error('Excel Export Error:', error);
      alert('Có lỗi khi xuất file Excel. Vui lòng thử lại.');
    }
  };

  const exportWord = async () => {
    try {
      if (sortedSessions.length === 0) {
        alert('Chưa có dữ liệu để xuất Word. Vui lòng nhập số bệnh nhân hoặc danh sách và nhấn "CẬP NHẬT".');
        return;
      }

      const tableRows = [
        new TableRow({
          children: [
            "STT", "Người bệnh", "Lần", "Y Lệnh", "Bắt đầu", "Kết thúc", "Điều dưỡng", "Máy"
          ].map(text => new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text, bold: true, size: 26, font: "Arial" })],
              alignment: AlignmentType.CENTER 
            })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "f3f4f6" }
          }))
        }),
        ...sortedSessions.map((s, idx) => new TableRow({
          children: [
            (idx + 1).toString(),
            s.patientName,
            `L${s.sessionOrder}`,
            s.orderTime || "",
            safeFormat(s.startTime, 'HH:mm'),
            safeFormat(s.endTime, 'HH:mm'),
            s.nurseName,
            s.machineCode
          ].map((text, i) => new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ 
                text, 
                size: 24, 
                bold: i === 1, // Bold the patient's name for visual structure
                font: "Arial" 
              })],
              alignment: i === 1 ? AlignmentType.LEFT : AlignmentType.CENTER 
            })],
            verticalAlign: VerticalAlign.CENTER
          }))
        }))
      ];

      const table = new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 },
        }
      });

      const doc = new DocxDocument({
        sections: [{
          children: [
            new Paragraph({
              children: [new TextRun({ text: "BỆNH VIỆN ĐA KHOA", bold: true, size: 24 })],
              alignment: AlignmentType.LEFT
            }),
            new Paragraph({
              children: [new TextRun({ text: "KHOA NỘI - NHI - NHIỄM", bold: true, size: 28 })],
              alignment: AlignmentType.LEFT
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [new TextRun({ text: "BẢNG LỊCH PHUN KHÍ DUNG", bold: true, size: 36, underline: {} })],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({
              children: [new TextRun({ text: `Ngày in: ${format(new Date(), 'dd/MM/yyyy')}` })],
              alignment: AlignmentType.RIGHT
            }),
            new Paragraph({ text: "" }),
            table
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Lich_Phun_Khi_Dung_${format(new Date(), 'yyyyMMdd')}.docx`);
    } catch (error) {
      console.error('Word Export Error:', error);
      alert('Có lỗi khi xuất file Word. Vui lòng thử lại.');
    }
  };

  const handleBrowserPrint = () => {
    if (sortedSessions.length === 0) {
      alert('Chưa có dữ liệu để In. Vui lòng nhập số bệnh nhân hoặc danh sách và nhấn "CẬP NHẬT".');
      return;
    }
    handlePrint();
  };

  const exportPDF = async () => {
    if (!printRef.current) return;
    if (sortedSessions.length === 0) {
      alert('Chưa có dữ liệu để xuất PDF. Vui lòng nhập số bệnh nhân hoặc danh sách và nhấn "CẬP NHẬT".');
      return;
    }
    
    try {
      setIsLoading(true);
      const lib = (html2pdf as any).default || html2pdf;
      if (typeof lib !== 'function') {
        throw new Error('PDF Library not initialized');
      }

      printRef.current.classList.add('is-exporting-pdf');
      
      const element = printRef.current;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Lich_Khi_Dung_${format(new Date(), 'ddMMyyyy')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          onclone: (doc: Document) => {
            const styleTags = doc.getElementsByTagName('style');
            for (let i = 0; i < styleTags.length; i++) {
              let css = styleTags[i].innerHTML;
              css = css.replace(/oklch\([^)]+\)/g, '#777777');
              css = css.replace(/oklab\([^)]+\)/g, '#777777');
              css = css.replace(/color-mix\([^)]+\)/g, '#777777');
              css = css.replace(/--[a-zA-Z0-9-]+:\s*oklch\([^)]+\);/g, '--tmp: #777;');
              css = css.replace(/--[a-zA-Z0-9-]+:\s*oklab\([^)]+\);/g, '--tmp: #777;');
              styleTags[i].innerHTML = css;
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await lib().set(opt).from(element).save();
    } catch (error: any) {
      console.error('PDF Export Error:', error);
      alert('Có lỗi khi tạo file PDF.');
    } finally {
      printRef.current?.classList.remove('is-exporting-pdf');
      setIsLoading(false);
    }
  };

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const nameCompare = a.patientName.localeCompare(b.patientName, 'vi', { sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      return a.sessionOrder - b.sessionOrder;
    });
  }, [sessions]);

  const getMachineColor = (code: string) => {
    const colorMap: Record<string, string> = {
      '032': '#3b82f6',
      '121': '#a855f7',
      '368': '#ec4899',
      '001': '#ef4444',
      '002': '#f59e0b',
      '003': '#10b981',
      '004': '#06b6d4',
      '005': '#f97316',
    };
    if (colorMap[code]) return colorMap[code];
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#3b82f6', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#f97316'];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="min-h-screen bg-[#f3f6ff] text-slate-900 font-sans">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] pt-12 pb-24 no-print shadow-xl">
        <div className="max-w-[1400px] mx-auto px-6 text-center text-white">
          <h1 className="text-4xl font-[900] tracking-tight uppercase mb-2 drop-shadow-md">
            HỆ THỐNG LẬP LỊCH PHUN KHÍ DUNG
          </h1>
          <p className="font-bold text-blue-100/90 tracking-widest uppercase text-sm">
            TTYT KHU VỰC CHỢ LÁCH • KHOA NỘI - NHI - NHIỄM
          </p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 -mt-16 flex flex-col lg:flex-row gap-8 pb-12">
        {/* Left Sidebar - Configuration */}
        <aside className="w-full lg:w-[380px] flex flex-col gap-6 no-print">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-blue-900/5 border border-white">
            <h4 className="flex items-center gap-3 font-black text-[#1e40af] mb-8 uppercase text-sm tracking-widest relative">
              <span className="w-1.5 h-6 bg-[#1e40af] rounded-full absolute -left-4" />
              Cấu hình hệ thống
            </h4>

            <div className="space-y-8">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Số bệnh nhân nội trú</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={totalPatients}
                    onChange={(e) => updateTotalPatients(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-xl outline-none focus:ring-2 ring-blue-500/20 transition-all"
                    placeholder="0"
                  />
                </div>
              </div>

              {nurses.map((nurse, idx) => (
                <div key={nurse.id}>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    {idx === 2 ? 'Điều dưỡng hành chính (ĐD 3)' : `Điều dưỡng trực ${idx === 0 ? 'A' : 'B'}`}
                  </label>
                  <input 
                    type="text" 
                    value={nurse.name}
                    onChange={(e) => {
                      const newNurses = [...nurses];
                      newNurses[idx].name = e.target.value;
                      updateNurses(newNurses);
                    }}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-lg outline-none focus:ring-2 ring-blue-500/20 transition-all text-slate-700"
                    placeholder="Nhập tên..."
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-blue-900/5 border border-white flex-1">
            <h4 className="flex items-center gap-3 font-black text-[#1e40af] mb-6 uppercase text-sm tracking-widest relative">
              <span className="w-1.5 h-6 bg-[#1e40af] rounded-full absolute -left-4" />
              Dữ liệu người bệnh PKD
            </h4>
            <textarea 
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 min-h-[300px] outline-none focus:ring-2 ring-blue-500/20 font-bold text-sm text-slate-600 resize-none leading-relaxed"
              placeholder="VD: Nguyễn Văn A - 08:30 - 3&#10;Trần Thị B - 09:00 - 2"
            />
            <p className="mt-3 text-[10px] text-slate-400 font-bold italic text-center">
              Tên - Giờ y lệnh - Số lần phun
            </p>
            <button 
              onClick={handleBulkAdd}
              disabled={isLoading || !bulkInput.trim()}
              className="w-full mt-6 bg-gradient-to-br from-[#1e40af] to-[#4f46e5] text-white py-5 rounded-[1.5rem] font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={20} /> : null}
              Tạo bảng phân công
            </button>
            {patients.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách người bệnh hiện tại không?')) {
                    setPatients([]);
                    setSessions([]);
                  }
                }}
                className="w-full mt-3 bg-red-50 text-red-600 hover:bg-red-100 py-3 rounded-2xl font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all border border-red-100/50"
              >
                Xóa toàn bộ danh sách ({patients.length})
              </button>
            )}
          </div>
        </aside>

        {/* Main Content - Schedule Table */}
        <main className="flex-1 flex flex-col gap-6">
          <div className="bg-white/80 backdrop-blur-md rounded-[2rem] overflow-hidden shadow-2xl shadow-blue-900/5 border border-white min-h-[800px]">
            <div className="p-8 pb-0 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
              <h2 className="text-3xl font-[900] text-slate-800 tracking-tight flex items-center gap-4">
                CHI TIẾT THỰC HIỆN
              </h2>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={exportExcel} 
                  className="bg-emerald-100 text-emerald-700 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-600 hover:text-white transition-all shadow-sm cursor-pointer"
                >
                  <TableIcon size={18} /> Xuất Excel
                </button>
                <button 
                  onClick={exportWord} 
                  className="bg-blue-100 text-blue-700 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-blue-600 hover:text-white transition-all shadow-sm cursor-pointer"
                >
                  <FileText size={18} /> Xuất Word
                </button>
                <button 
                  onClick={handleBrowserPrint} 
                  className="bg-slate-100 text-slate-700 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-sm cursor-pointer"
                >
                  <Printer size={18} /> In trực tiếp
                </button>
              </div>
            </div>

            <div ref={printRef} className="p-8 print:p-0">
              {/* PDF Only Print Header */}
              <div className="hidden print:flex flex-col gap-2 mb-10 border-b-2 border-black pb-6 text-black">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-bold text-xs uppercase">BỆNH VIỆN ĐA KHOA</h5>
                    <h4 className="font-black text-sm uppercase">KHOA NỘI - NHI - NHIỄM</h4>
                  </div>
                  <div className="text-right text-[10px]">
                    <p>Ngày in: {format(new Date(), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
                <div className="text-center mt-6">
                  <h1 className="text-2xl font-black uppercase underline decoration-2 underline-offset-8">BẢNG LỊCH PHUN KHÍ DUNG</h1>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-4">
                  <thead>
                    <tr className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      <th className="px-1 py-2 text-center w-8">STT</th>
                      <th className="px-4 py-2 text-left">NGƯỜI BỆNH</th>
                      <th className="px-4 py-2 text-center w-16 whitespace-nowrap">LẦN</th>
                      <th className="px-4 py-2 text-center w-16">Y LỆNH</th>
                      <th className="px-4 py-2 text-center w-24 whitespace-nowrap">BẮT ĐẦU</th>
                      <th className="px-4 py-2 text-center w-24 whitespace-nowrap">KẾT THÚC</th>
                      <th className="px-4 py-2 text-center w-28">ĐIỀU DƯỠNG</th>
                      <th className="px-4 py-2 text-center w-20">MÁY</th>
                      <th className="px-4 py-2 text-center no-pdf">GHI CHÚ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSessions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-32 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-20">
                            <RefreshCw size={64} className="text-blue-900" />
                            <p className="font-black text-xl uppercase tracking-tighter text-blue-900">Vui lòng nhập dữ liệu để bắt đầu</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      sortedSessions.map((s, idx) => (
                        <tr key={idx} className="group hover:scale-[1.01] transition-transform duration-200">
                          <td className="bg-slate-50/50 rounded-l-[1.5rem] px-1 py-6 text-center font-bold text-slate-400 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="bg-white px-2 py-6 border-y border-slate-100">
                            <div className="font-black text-slate-800 uppercase tracking-tight text-sm">
                              {s.patientName}
                            </div>
                          </td>
                          <td className="bg-white px-2 py-6 border-y border-slate-100 text-center">
                            <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-tighter">
                              L{s.sessionOrder}
                            </span>
                          </td>
                          <td className="bg-white px-2 py-6 border-y border-slate-100 text-center font-bold text-slate-400 text-sm">
                            {s.orderTime}
                          </td>
                          <td className="bg-blue-50/30 px-2 py-6 border-y border-blue-50/50 text-center">
                            <span className="font-black text-xl text-blue-700 tabular-nums tracking-tight">
                              {safeFormat(s.startTime, 'HH:mm')}
                            </span>
                          </td>
                          <td className="bg-emerald-50/30 px-2 py-6 border-y border-emerald-50/50 text-center">
                            <span className="font-black text-xl text-emerald-700 tabular-nums tracking-tight">
                              {safeFormat(s.endTime, 'HH:mm')}
                            </span>
                          </td>
                          <td className="bg-white px-2 py-6 border-y border-slate-100 text-center">
                            <span className="font-bold text-slate-600 text-sm italic">{s.nurseName}</span>
                          </td>
                          <td className="bg-white px-2 py-6 border-y border-slate-100 text-center">
                            <span 
                              className="px-4 py-1.5 text-white rounded-lg font-mono font-black text-xs shadow-lg shadow-current/20 pdf-machine-badge"
                              style={{ backgroundColor: getMachineColor(s.machineCode), color: 'white', boxShadow: `0 4px 12px ${getMachineColor(s.machineCode)}44` }}
                            >
                              {s.machineCode}
                            </span>
                          </td>
                          <td className="bg-slate-50/30 rounded-r-[1.5rem] px-4 py-6 text-center italic text-slate-300 text-[10px] font-bold uppercase no-pdf">
                            Chưa có ghi chú
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        @font-face {
          font-family: 'Inter';
          src: url('https://rsms.me/inter/font-files/Inter-ExtraBold.woff2?v=3.19') format('woff2');
        }
        
        .no-print { display: block; }
        .hidden-print { display: none; }
        
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          table { width: 100% !important; border-collapse: collapse !important; border-spacing: 0 !important; font-size: 13px !important; }
          table tr { background: transparent !important; border-bottom: 1px solid #000 !important; }
          table td { padding: 12px 6px !important; border: none !important; }
          table th { border-bottom: 2px solid #000 !important; color: black !important; padding: 12px 6px !important; }
          @page { size: portrait; margin: 1.5cm; }
          .bg-blue-50/30, .bg-emerald-50/30, .bg-slate-50/50 { background: transparent !important; }
          .text-blue-700, .text-emerald-700 { color: black !important; font-weight: 900 !important; }
          span[style] { box-shadow: none !important; border: 1px solid #000 !important; color: black !important; background: transparent !important; }
        }
        
        .is-exporting-pdf { width: 790px !important; background: white !important; padding: 15px !important; border: none !important; }
        .is-exporting-pdf table { border-collapse: collapse !important; width: 100% !important; border: 1.2pt solid black !important; table-layout: fixed !important; margin-top: 10px !important; }
        .is-exporting-pdf td, .is-exporting-pdf th { border: 0.8pt solid black !important; padding: 8px 4px !important; font-size: 11px !important; color: black !important; vertical-align: middle; word-wrap: break-word !important; overflow: hidden !important; text-align: center !important; }
        .is-exporting-pdf th { background-color: #f7f9fc !important; font-weight: bold !important; text-transform: uppercase !important; }
        .is-exporting-pdf td:nth-child(2) { text-align: left !important; font-weight: 900 !important; }
        
        .is-exporting-pdf th:nth-child(1), .is-exporting-pdf td:nth-child(1) { width: 35px !important; }
        .is-exporting-pdf th:nth-child(2), .is-exporting-pdf td:nth-child(2) { width: auto !important; }
        .is-exporting-pdf th:nth-child(3), .is-exporting-pdf td:nth-child(3) { width: 40px !important; }
        .is-exporting-pdf th:nth-child(4), .is-exporting-pdf td:nth-child(4) { width: 55px !important; }
        .is-exporting-pdf th:nth-child(5), .is-exporting-pdf td:nth-child(5) { width: 70px !important; }
        .is-exporting-pdf th:nth-child(6), .is-exporting-pdf td:nth-child(6) { width: 70px !important; }
        .is-exporting-pdf th:nth-child(7), .is-exporting-pdf td:nth-child(7) { width: 100px !important; }
        .is-exporting-pdf th:nth-child(8), .is-exporting-pdf td:nth-child(8) { width: 50px !important; }
        
        .is-exporting-pdf .pdf-machine-badge { 
          background: transparent !important; 
          color: black !important; 
          border: none !important; 
          box-shadow: none !important; 
          font-size: 11px !important; 
          font-weight: 900 !important; 
          padding: 0 !important;
          display: inline !important;
        }
        .is-exporting-pdf .no-pdf { display: none !important; }
        .is-exporting-pdf div, .is-exporting-pdf span { box-shadow: none !important; transform: none !important; }
      `}</style>
    </div>
  );
}

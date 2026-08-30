import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Nurse, Patient, TreatmentSession, NURSES, scheduleTreatments } from './lib/scheduler';
import { 
  getScheduleByDate, 
  saveScheduleByDate, 
  getYesterdayDate,
  getDepartmentMachines,
  saveDepartmentMachines,
  getPatientsAsRawText,
  convertPatientsToRawText,
  getAvailableDates
} from './lib/dateStorage';
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
import { HistoryModal } from './components/HistoryModal';
import { CopyScheduleModal } from './components/CopyScheduleModal';
import { MachineManagerModal } from './components/MachineManagerModal';
import { format, parseISO } from 'date-fns';
import { 
  Users, 
  Stethoscope, 
  FileDown, 
  Printer, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Table as TableIcon,
  FileText,
  Calendar,
  Copy,
  Zap,
  History,
  Cpu,
  Settings2,
  ArrowDownToLine,
  Check,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<TreatmentSession[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>(NURSES);
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [bulkInput, setBulkInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [departmentMachines, setDepartmentMachines] = useState<string[]>(() => getDepartmentMachines());
  const printRef = useRef<HTMLDivElement>(null);

  // Modals
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [isQuickYesterdayMode, setIsQuickYesterdayMode] = useState(false);

  const availableHistoryDates = useMemo(() => getAvailableDates(), [selectedDate, showHistoryModal, showCopyModal]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Lich_Phun_Khi_Dung_${selectedDate}`,
  });

  // Load config & date schedule on mount or selectedDate change
  useEffect(() => {
    const savedN = localStorage.getItem('hospital_nurses');
    const savedT = localStorage.getItem('hospital_total_patients');
    
    if (savedN) setNurses(JSON.parse(savedN));
    if (savedT) setTotalPatients(parseInt(savedT));

    // Load schedule for selectedDate
    const existing = getScheduleByDate(selectedDate);
    if (existing) {
      setPatients(existing.patients || []);
      setSessions(existing.sessions || []);
    } else {
      setPatients([]);
      setSessions([]);
    }
  }, [selectedDate]);

  const updateDataAndSave = (
    newPatients: Patient[], 
    currentNurses: Nurse[] = nurses, 
    currentTotal: number = totalPatients,
    targetDate: string = selectedDate
  ) => {
    const generatedSessions = scheduleTreatments(newPatients, currentNurses, currentTotal);
    setPatients(newPatients);
    setSessions(generatedSessions);
    saveScheduleByDate(targetDate, newPatients, generatedSessions, currentTotal);
  };

  const updateNurses = (newNurses: Nurse[]) => {
    setNurses(newNurses);
    localStorage.setItem('hospital_nurses', JSON.stringify(newNurses));
    const updatedSessions = scheduleTreatments(patients, newNurses, totalPatients);
    setSessions(updatedSessions);
    saveScheduleByDate(selectedDate, patients, updatedSessions, totalPatients);
  };

  const handleSaveMachines = (newMachines: string[]) => {
    setDepartmentMachines(newMachines);
    saveDepartmentMachines(newMachines);
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleNurseMachineChange = (nurseIndex: number, newCode: string) => {
    const updated = [...nurses];
    updated[nurseIndex].machineCode = newCode;
    updateNurses(updated);
  };

  const handleLoadYesterdayRawText = () => {
    const yesterday = getYesterdayDate(selectedDate);
    const rawText = getPatientsAsRawText(yesterday);
    if (!rawText.trim()) {
      setInfoBanner(`⚠️ Chưa tìm thấy lịch phun khí dung của ngày hôm qua (${format(parseISO(yesterday), 'dd/MM/yyyy')}). Bạn có thể bấm nút "LỊCH SỬ" ở trên để chọn ngày khác.`);
      setTimeout(() => setInfoBanner(null), 7000);
      return;
    }

    setBulkInput(rawText);
    const linesCount = rawText.trim().split('\n').length;
    setInfoBanner(`Đã nạp ${linesCount} người bệnh từ ngày hôm qua (${format(parseISO(yesterday), 'dd/MM/yyyy')}). Bạn có thể xóa bệnh nhân đã xuất viện rồi bấm "TẠO BẢNG PHÂN CÔNG".`);
    setTimeout(() => setInfoBanner(null), 8000);
  };

  const handleLoadDateRawText = (targetDateStr: string) => {
    if (!targetDateStr) return;
    const rawText = getPatientsAsRawText(targetDateStr);
    if (!rawText.trim()) {
      setInfoBanner(`⚠️ Ngày ${format(parseISO(targetDateStr), 'dd/MM/yyyy')} chưa có dữ liệu người bệnh.`);
      setTimeout(() => setInfoBanner(null), 6000);
      return;
    }

    setBulkInput(rawText);
    const linesCount = rawText.trim().split('\n').length;
    setInfoBanner(`Đã nạp ${linesCount} người bệnh từ ngày ${format(parseISO(targetDateStr), 'dd/MM/yyyy')}. Bạn có thể chỉnh sửa và bấm "TẠO BẢNG PHÂN CÔNG".`);
    setTimeout(() => setInfoBanner(null), 8000);
  };

  const updateTotalPatients = (val: number) => {
    setTotalPatients(val);
    localStorage.setItem('hospital_total_patients', val.toString());
    const updatedSessions = scheduleTreatments(patients, nurses, val);
    setSessions(updatedSessions);
    saveScheduleByDate(selectedDate, patients, updatedSessions, val);
  };

  const handleBulkAdd = () => {
    if (!bulkInput.trim()) return;
    setIsLoading(true);
    
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
        date: selectedDate,
        orderTime: time || '08:00',
        times: parseInt(timesStr) || 1,
        notes: ''
      };
    });

    setPatients(newPs);
    
    setTimeout(() => {
      const generatedSessions = scheduleTreatments(newPs, nurses, totalPatients);
      setSessions(generatedSessions);
      saveScheduleByDate(selectedDate, newPs, generatedSessions, totalPatients);
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
            BVĐK KHU VỰC CHỢ LÁCH • KHOA NỘI TH - NHI - TRUYỀN NHIỄM
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

            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Ngày làm việc</label>
                <div className="relative flex items-center gap-2">
                  <Calendar size={20} className="text-blue-600 absolute left-4 pointer-events-none" />
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-blue-50/50 border border-blue-200 rounded-2xl pl-12 pr-4 py-3 font-black text-base text-blue-900 outline-none focus:ring-2 ring-blue-500/20 transition-all cursor-pointer shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Số bệnh nhân nội trú</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={totalPatients}
                    onChange={(e) => updateTotalPatients(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-black text-lg outline-none focus:ring-2 ring-blue-500/20 transition-all"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Nurses and Machine Assignments */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    Điều dưỡng & Mã máy
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMachineModal(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Quản lý danh mục mã máy của khoa"
                  >
                    <Cpu size={13} /> Quản lý mã máy
                  </button>
                </div>

                {nurses.map((nurse, idx) => (
                  <div key={nurse.id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>{idx === 2 ? 'Điều dưỡng hành chính (ĐD 3)' : `Điều dưỡng trực ${idx === 0 ? 'A' : 'B'}`}</span>
                      <span className="flex items-center gap-1.5 font-mono text-xs font-black">
                        <span 
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: getMachineColor(nurse.machineCode) }}
                        />
                        Máy: {nurse.machineCode}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={nurse.name}
                        onChange={(e) => {
                          const newNurses = [...nurses];
                          newNurses[idx].name = e.target.value;
                          updateNurses(newNurses);
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 font-bold text-sm outline-none focus:ring-2 ring-blue-500/20 text-slate-800"
                        placeholder="Nhập tên ĐD..."
                      />

                      <select
                        value={nurse.machineCode}
                        onChange={(e) => handleNurseMachineChange(idx, e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono font-black text-xs text-blue-900 outline-none focus:ring-2 ring-blue-500/20 cursor-pointer"
                        title="Chọn mã máy phụ trách"
                      >
                        {departmentMachines.map(m => (
                          <option key={m} value={m}>
                            Máy {m}
                          </option>
                        ))}
                        {!departmentMachines.includes(nurse.machineCode) && (
                          <option value={nurse.machineCode}>
                            Máy {nurse.machineCode}
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowMachineModal(true)}
                className="w-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200"
              >
                <Cpu size={15} className="text-blue-600" /> Bổ sung / Cấu hình mã máy của khoa
              </button>
            </div>
          </div>

          {/* Bulk Patient Input Area */}
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-blue-900/5 border border-white flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h4 className="flex items-center gap-3 font-black text-[#1e40af] uppercase text-sm tracking-widest relative">
                <span className="w-1.5 h-6 bg-[#1e40af] rounded-full absolute -left-4" />
                Dữ liệu người bệnh PKD
              </h4>
            </div>

            {/* Notification Banner */}
            {infoBanner && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">{infoBanner}</div>
                <button onClick={() => setInfoBanner(null)} className="text-emerald-600 hover:text-emerald-900 font-black ml-1 cursor-pointer">✕</button>
              </div>
            )}

            {/* Quick Load Tools from Previous Days */}
            <div className="mb-3 p-3 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black text-blue-900 uppercase tracking-wider">
                <span>⚡ Lấy dữ liệu hôm trước (Tên - Giờ - Lần):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLoadYesterdayRawText}
                  className="flex-1 bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Nạp nhanh danh sách ngày hôm qua vào ô nhập liệu"
                >
                  <ArrowDownToLine size={14} /> Tải ngày hôm qua
                </button>

                {availableHistoryDates.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleLoadDateRawText(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="bg-white border border-blue-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold outline-none cursor-pointer shadow-sm"
                  >
                    <option value="" disabled>📅 Chọn ngày khác...</option>
                    {availableHistoryDates.map(d => (
                      <option key={d} value={d}>
                        Ngày {format(parseISO(d), 'dd/MM/yyyy')}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <textarea 
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[220px] flex-1 outline-none focus:ring-2 ring-blue-500/20 font-mono font-bold text-xs text-slate-700 resize-none leading-relaxed shadow-inner"
              placeholder="VD:&#10;Nguyễn Văn A - 08:30 - 3&#10;Trần Thị B - 09:00 - 2&#10;Lê Văn C - 08:00 - 1"
            />
            <p className="mt-2 text-[10px] text-slate-400 font-bold italic text-center">
              Định dạng: Tên - Giờ y lệnh - Số lần phun
            </p>

            <button 
              onClick={handleBulkAdd}
              disabled={isLoading || !bulkInput.trim()}
              className="w-full mt-4 bg-gradient-to-br from-[#1e40af] to-[#4f46e5] text-white py-4 rounded-[1.5rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={18} /> : null}
              Tạo bảng phân công
            </button>

            {patients.length > 0 && (
              <div className="space-y-2 mt-2.5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = convertPatientsToRawText(patients);
                      setBulkInput(text);
                      setInfoBanner('Đã đưa danh sách hiện tại vào ô nhập để bạn chỉnh sửa.');
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Chuyển bảng hiện tại vào ô nhập để sửa tiếp"
                  >
                    <Edit3 size={13} /> Sửa danh sách hiện tại
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition-all border border-red-100 cursor-pointer"
                    title="Xóa danh sách"
                  >
                    Xóa ({patients.length})
                  </button>
                </div>

                {showClearConfirm && (
                  <div className="bg-red-50 border border-red-200 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-red-800 animate-in fade-in">
                    <span>Xác nhận xóa {patients.length} BN?</span>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPatients([]);
                          setSessions([]);
                          saveScheduleByDate(selectedDate, [], [], totalPatients);
                          setShowClearConfirm(false);
                          setInfoBanner('Đã xóa toàn bộ danh sách người bệnh hiện tại.');
                          setTimeout(() => setInfoBanner(null), 4000);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer shadow-sm"
                      >
                        Xóa hết
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(false)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content - Schedule Table */}
        <main className="flex-1 flex flex-col gap-6">
          <div className="bg-white/80 backdrop-blur-md rounded-[2rem] overflow-hidden shadow-2xl shadow-blue-900/5 border border-white min-h-[800px]">
            <div className="p-8 pb-0 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
              <div>
                <h2 className="text-3xl font-[900] text-slate-800 tracking-tight flex items-center gap-4">
                  CHI TIẾT THỰC HIỆN
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  Ngày đang hiển thị: <span className="text-blue-600 font-black">{format(parseISO(selectedDate), 'dd/MM/yyyy')}</span> ({sessions.length} lượt phun)
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button 
                  onClick={() => {
                    setIsQuickYesterdayMode(false);
                    setShowCopyModal(true);
                  }}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Copy size={16} /> Sao chép lịch
                </button>
                <button 
                  onClick={() => {
                    setIsQuickYesterdayMode(true);
                    setShowCopyModal(true);
                  }}
                  className="bg-amber-500 text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Zap size={16} /> Sao chép hôm qua
                </button>
                <button 
                  onClick={() => setShowHistoryModal(true)}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <History size={16} /> Lịch sử
                </button>
                <button 
                  onClick={exportExcel} 
                  className="bg-emerald-100 text-emerald-700 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-emerald-600 hover:text-white transition-all shadow-sm cursor-pointer"
                >
                  <TableIcon size={16} /> Xuất Excel
                </button>
                <button 
                  onClick={exportWord} 
                  className="bg-blue-100 text-blue-700 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-blue-600 hover:text-white transition-all shadow-sm cursor-pointer"
                >
                  <FileText size={16} /> Xuất Word
                </button>
                <button 
                  onClick={handleBrowserPrint} 
                  className="bg-slate-100 text-slate-700 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-slate-900 hover:text-white transition-all shadow-sm cursor-pointer"
                >
                  <Printer size={16} /> In
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

      {/* History Modal */}
      {showHistoryModal && (
        <HistoryModal 
          initialDate={selectedDate}
          onClose={() => setShowHistoryModal(false)}
          onSelectDateToLoad={(dateStr) => {
            setSelectedDate(dateStr);
          }}
          onLoadRawTextToBulkInput={(text, dateStr) => {
            setBulkInput(text);
            const linesCount = text.trim().split('\n').length;
            setInfoBanner(`Đã tải ${linesCount} bệnh nhân ngày ${format(parseISO(dateStr), 'dd/MM/yyyy')} vào ô nhập liệu. Bạn có thể xóa bệnh nhân xuất viện và bấm "Tạo bảng phân công".`);
          }}
        />
      )}

      {/* Copy Schedule Modal */}
      {showCopyModal && (
        <CopyScheduleModal
          currentTargetDate={selectedDate}
          isQuickYesterdayMode={isQuickYesterdayMode}
          onClose={() => setShowCopyModal(false)}
          onSuccess={(targetDate, newPatients, newSessions) => {
            setSelectedDate(targetDate);
            setPatients(newPatients);
            setSessions(newSessions);
          }}
          nurses={nurses}
          totalPatientsInDept={totalPatients}
        />
      )}

      {/* Machine Manager Modal */}
      {showMachineModal && (
        <MachineManagerModal
          machines={departmentMachines}
          nurses={nurses}
          onSaveMachines={handleSaveMachines}
          onUpdateNurses={updateNurses}
          onClose={() => setShowMachineModal(false)}
        />
      )}

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

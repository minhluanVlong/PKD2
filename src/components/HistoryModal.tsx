import React, { useState, useMemo } from 'react';
import { getScheduleByDate, getAvailableDates, DailySchedule, convertPatientsToRawText } from '../lib/dateStorage';
import { TreatmentSession } from '../lib/scheduler';
import { format, parseISO } from 'date-fns';
import { 
  X, 
  Search, 
  Calendar, 
  Table as TableIcon, 
  FileText, 
  Printer, 
  Users, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Edit3
} from 'lucide-react';
import * as XLSX from 'xlsx';
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

interface HistoryModalProps {
  initialDate: string;
  onClose: () => void;
  onSelectDateToLoad?: (dateStr: string) => void;
  onLoadRawTextToBulkInput?: (text: string, dateStr: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ 
  initialDate, 
  onClose, 
  onSelectDateToLoad,
  onLoadRawTextToBulkInput 
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [activeSchedule, setActiveSchedule] = useState<DailySchedule | null>(() => getScheduleByDate(initialDate));
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'rawText'>('table');
  const [copiedText, setCopiedText] = useState(false);

  const availableDates = useMemo(() => getAvailableDates(), []);

  const handleSearchDate = (dateToSearch: string) => {
    setSelectedDate(dateToSearch);
    const found = getScheduleByDate(dateToSearch);
    setActiveSchedule(found);
  };

  // Raw text formatted as: Tên - Giờ - Lần
  const rawTextData = useMemo(() => {
    if (!activeSchedule || !activeSchedule.patients) return '';
    return convertPatientsToRawText(activeSchedule.patients);
  }, [activeSchedule]);

  const handleCopyRawText = () => {
    if (!rawTextData) return;
    navigator.clipboard.writeText(rawTextData);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleLoadIntoInput = () => {
    if (!rawTextData || !onLoadRawTextToBulkInput) return;
    onLoadRawTextToBulkInput(rawTextData, selectedDate);
    onClose();
  };

  // Stats calculation
  const stats = useMemo(() => {
    if (!activeSchedule || !activeSchedule.patients) {
      return { totalPatients: 0, totalSessions: 0, count2Times: 0, count3Times: 0 };
    }
    const patients = activeSchedule.patients;
    const sessions = activeSchedule.sessions || [];
    const count2Times = patients.filter(p => p.times === 2).length;
    const count3Times = patients.filter(p => p.times === 3).length;

    return {
      totalPatients: patients.length,
      totalSessions: sessions.length,
      count2Times,
      count3Times
    };
  }, [activeSchedule]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    if (!activeSchedule || !activeSchedule.sessions) return [];
    if (!searchTerm.trim()) return activeSchedule.sessions;

    const term = searchTerm.toLowerCase().trim();
    return activeSchedule.sessions.filter(s => 
      s.patientName.toLowerCase().includes(term) || 
      (s.patientId && s.patientId.toLowerCase().includes(term))
    );
  }, [activeSchedule, searchTerm]);

  const safeFormatTime = (d: Date | string) => {
    try {
      const dateObj = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(dateObj.getTime())) return '--:--';
      return format(dateObj, 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  // Export Excel
  const exportExcel = () => {
    if (!activeSchedule || filteredSessions.length === 0) {
      alert('Không có dữ liệu để xuất Excel.');
      return;
    }

    const excelData = filteredSessions.map((s, idx) => ({
      'STT': idx + 1,
      'Họ và tên Bệnh nhân': s.patientName,
      'Mã BN': s.patientId,
      'Lần phun': `Lần ${s.sessionOrder}`,
      'Giờ Y lệnh': s.orderTime,
      'Giờ bắt đầu': safeFormatTime(s.startTime),
      'Giờ kết thúc': safeFormatTime(s.endTime),
      'Điều dưỡng phụ trách': s.nurseName,
      'Mã máy': s.machineCode,
      'Ghi chú': s.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LichSuPhunKhiDung');
    XLSX.writeFile(workbook, `LichSu_PhunKhiDung_${selectedDate}.xlsx`);
  };

  // Export Word
  const exportWord = async () => {
    if (!activeSchedule || filteredSessions.length === 0) {
      alert('Không có dữ liệu để xuất Word.');
      return;
    }

    try {
      const formattedDateStr = format(parseISO(selectedDate), 'dd/MM/yyyy');

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
        ...filteredSessions.map((s, idx) => new TableRow({
          children: [
            (idx + 1).toString(),
            s.patientName,
            `L${s.sessionOrder}`,
            s.orderTime || "",
            safeFormatTime(s.startTime),
            safeFormatTime(s.endTime),
            s.nurseName,
            s.machineCode
          ].map((text, i) => new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ 
                text, 
                size: 24, 
                bold: i === 1,
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
              children: [new TextRun({ text: `LỊCH PHUN KHÍ DUNG NGÀY ${formattedDateStr}`, bold: true, size: 36, underline: {} })],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({ text: "" }),
            table
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `LichSu_PhunKhiDung_${selectedDate}.docx`);
    } catch (error) {
      console.error('Word Export Error:', error);
      alert('Có lỗi khi xuất file Word.');
    }
  };

  // Print
  const handlePrint = () => {
    if (!activeSchedule || filteredSessions.length === 0) {
      alert('Không có dữ liệu để in.');
      return;
    }
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black">
              <Calendar size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">LỊCH SỬ PHUN KHÍ DUNG</h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Xem lại chi tiết lịch phun khí dung các ngày trước đó</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Controls Bar: Date Selector, View Mode & Search */}
        <div className="p-6 bg-slate-50 border-b border-slate-200/80 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Ngày:</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-300 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
            <button
              onClick={() => handleSearchDate(selectedDate)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Search size={16} /> Xem
            </button>

            {availableDates.length > 0 && (
              <select
                onChange={(e) => handleSearchDate(e.target.value)}
                value={selectedDate}
                className="px-3 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none shadow-sm ml-1"
              >
                <option value="">-- Chọn ngày có lịch --</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>
                    {format(parseISO(d), 'dd/MM/yyyy')}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            {/* View Mode Toggle */}
            <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'table' 
                    ? 'bg-white text-blue-700 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon size={14} /> Bảng chi tiết
              </button>
              <button
                type="button"
                onClick={() => setViewMode('rawText')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'rawText' 
                    ? 'bg-white text-blue-700 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 size={14} /> Dạng văn bản nhập liệu
              </button>
            </div>

            {viewMode === 'table' && (
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm người bệnh..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {!activeSchedule ? (
            <div className="text-center py-16 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">Chưa có dữ liệu cho ngày {selectedDate ? format(parseISO(selectedDate), 'dd/MM/yyyy') : ''}</h3>
              <p className="text-xs text-slate-400 mt-1">Vui lòng chọn ngày khác hoặc chuyển đến bảng điều khiển chính để tạo lịch mới.</p>
            </div>
          ) : viewMode === 'rawText' ? (
            /* Raw Text View Mode (Tên - Giờ - Lần) */
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-blue-900 uppercase">
                    📝 Dữ liệu dạng văn bản (Tên - Giờ chỉ định - Số lần phun)
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Dữ liệu gốc ngày <strong>{format(parseISO(selectedDate), 'dd/MM/yyyy')}</strong> ({stats.totalPatients} người bệnh)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyRawText}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    {copiedText ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    {copiedText ? 'Đã sao chép!' : 'Sao chép văn bản'}
                  </button>

                  {onLoadRawTextToBulkInput && (
                    <button
                      onClick={handleLoadIntoInput}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-600/20"
                    >
                      <Edit3 size={15} /> Nạp vào ô nhập liệu chính để chỉnh sửa
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={rawTextData}
                  className="w-full bg-slate-900 text-emerald-400 font-mono text-sm p-6 rounded-3xl border border-slate-800 h-[380px] outline-none shadow-inner leading-relaxed select-all resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                <span className="text-base leading-none">💡</span>
                <div>
                  <strong>Hướng dẫn chỉnh sửa bệnh nhân xuất viện:</strong> Bấm nút <strong>"Nạp vào ô nhập liệu chính để chỉnh sửa"</strong> để tải toàn bộ danh sách trên vào khung nhập liệu hàng ngày. Tại đó, bạn có thể xóa nhanh các dòng của bệnh nhân đã xuất viện, thêm người bệnh mới hoặc sửa đổi giờ chỉ định, rồi bấm <strong>"Tạo bảng phân công"</strong>.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Stats Summary Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Tổng người bệnh</p>
                    <p className="text-xl font-black text-slate-900">{stats.totalPatients} <span className="text-xs font-normal text-slate-500">bệnh nhân</span></p>
                  </div>
                </div>

                <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Tổng lượt phun</p>
                    <p className="text-xl font-black text-slate-900">{stats.totalSessions} <span className="text-xs font-normal text-slate-500">lượt</span></p>
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-100 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Phun 2 lần/ngày</p>
                    <p className="text-xl font-black text-slate-900">{stats.count2Times} <span className="text-xs font-normal text-slate-500">BN</span></p>
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Phun 3 lần/ngày</p>
                    <p className="text-xl font-black text-slate-900">{stats.count3Times} <span className="text-xs font-normal text-slate-500">BN</span></p>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-3 text-center w-12 border-r border-slate-200">STT</th>
                      <th className="py-3 px-4 border-r border-slate-200">NGƯỜI BỆNH</th>
                      <th className="py-3 px-3 text-center w-16 border-r border-slate-200">LẦN</th>
                      <th className="py-3 px-3 text-center w-20 border-r border-slate-200">Y LỆNH</th>
                      <th className="py-3 px-3 text-center w-24 border-r border-slate-200">BẮT ĐẦU</th>
                      <th className="py-3 px-3 text-center w-24 border-r border-slate-200">KẾT THÚC</th>
                      <th className="py-3 px-4 border-r border-slate-200">ĐIỀU DƯỠNG</th>
                      <th className="py-3 px-3 text-center w-20 border-r border-slate-200">MÁY</th>
                      <th className="py-3 px-4">GHI CHÚ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
                    {filteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                          Không tìm thấy lượt phun phù hợp với từ khóa "{searchTerm}"
                        </td>
                      </tr>
                    ) : (
                      filteredSessions.map((s, idx) => (
                        <tr key={s.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-slate-400 border-r border-slate-200">{idx + 1}</td>
                          <td className="py-3 px-4 font-black uppercase text-slate-900 border-r border-slate-200">
                            {s.patientName}
                            {s.patientId && <span className="block text-[10px] font-mono text-slate-400 font-normal">{s.patientId}</span>}
                          </td>
                          <td className="py-3 px-3 text-center font-bold border-r border-slate-200">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-mono text-[11px]">
                              Lần {s.sessionOrder}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-600 border-r border-slate-200">{s.orderTime}</td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-600 border-r border-slate-200">{safeFormatTime(s.startTime)}</td>
                          <td className="py-3 px-3 text-center font-bold text-slate-600 border-r border-slate-200">{safeFormatTime(s.endTime)}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700 border-r border-slate-200">{s.nurseName}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700 border-r border-slate-200">
                            <span className="px-2 py-0.5 bg-indigo-50 rounded border border-indigo-200">
                              {s.machineCode}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 italic">{s.notes || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="p-6 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportExcel}
              disabled={!activeSchedule || filteredSessions.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <TableIcon size={16} /> Xuất Excel
            </button>
            <button
              onClick={exportWord}
              disabled={!activeSchedule || filteredSessions.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileText size={16} /> Xuất Word
            </button>
            <button
              onClick={handlePrint}
              disabled={!activeSchedule || filteredSessions.length === 0}
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Printer size={16} /> In
            </button>
            {onSelectDateToLoad && activeSchedule && (
              <button
                onClick={() => {
                  onSelectDateToLoad(selectedDate);
                  onClose();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} /> Mở lịch ngày này trên màn hình chính
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

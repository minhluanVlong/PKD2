import React, { useState, useEffect, useMemo } from 'react';
import { getScheduleByDate, getYesterdayDate, saveScheduleByDate } from '../lib/dateStorage';
import { Patient, TreatmentSession, Nurse, NURSES, scheduleTreatments } from '../lib/scheduler';
import { format, parseISO } from 'date-fns';
import { 
  X, 
  Copy, 
  Zap, 
  Calendar, 
  CheckSquare, 
  Square, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  RefreshCw,
  Info,
  Clock,
  UserCheck
} from 'lucide-react';

interface CopyScheduleModalProps {
  currentTargetDate: string; // Active target date e.g. YYYY-MM-DD
  isQuickYesterdayMode?: boolean; // If triggered by "⚡ SAO CHÉP NGÀY HÔM QUA"
  onClose: () => void;
  onSuccess: (targetDate: string, newPatients: Patient[], newSessions: TreatmentSession[]) => void;
  nurses: Nurse[];
  totalPatientsInDept: number;
}

export interface PatientCopyItem {
  patient: Patient;
  selected: boolean;
  duplicateStatus: 'none' | 'exists'; // If already in target date
  duplicateAction: 'skip' | 'replace' | 'keep_both';
  ineligibleReason?: string; // If discharged/transferred
}

export const CopyScheduleModal: React.FC<CopyScheduleModalProps> = ({
  currentTargetDate,
  isQuickYesterdayMode = false,
  onClose,
  onSuccess,
  nurses,
  totalPatientsInDept
}) => {
  // Step 1: Selection & Date Config
  // Step 2: Preview Screen
  // Step 3: Success Confirmation
  const [step, setStep] = useState<'config' | 'preview' | 'success'>('config');

  const defaultSourceDate = useMemo(() => {
    return getYesterdayDate(currentTargetDate);
  }, [currentTargetDate]);

  const [sourceDate, setSourceDate] = useState<string>(defaultSourceDate);
  const [targetDate, setTargetDate] = useState<string>(currentTargetDate);

  const [copyList, setCopyList] = useState<PatientCopyItem[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [targetExistingPatients, setTargetExistingPatients] = useState<Patient[]>([]);

  // Preview generated schedule data
  const [previewPatients, setPreviewPatients] = useState<Patient[]>([]);
  const [previewSessions, setPreviewSessions] = useState<TreatmentSession[]>([]);
  
  // Stats summary for preview & success modal
  const [stats, setStats] = useState({
    totalSource: 0,
    copiedCount: 0,
    existsCount: 0,
    skippedCount: 0
  });

  // Load patient list from source date & check duplicates on target date
  const loadSourceData = (sDate: string, tDate: string) => {
    const sourceSchedule = getScheduleByDate(sDate);
    const targetSchedule = getScheduleByDate(tDate);

    const existingTargetPatients = targetSchedule ? targetSchedule.patients || [] : [];
    setTargetExistingPatients(existingTargetPatients);

    if (!sourceSchedule || !sourceSchedule.patients || sourceSchedule.patients.length === 0) {
      setCopyList([]);
      setIsDataLoaded(true);
      return;
    }

    const items: PatientCopyItem[] = sourceSchedule.patients.map((p) => {
      // Check if patient already exists on target date by name or patientId
      const exists = existingTargetPatients.some(
        ep => ep.patientId === p.patientId || ep.name.trim().toLowerCase() === p.name.trim().toLowerCase()
      );

      return {
        patient: p,
        selected: !exists, // Default: select if not exists, unselect if exists (BỎ QUA by default)
        duplicateStatus: exists ? 'exists' : 'none',
        duplicateAction: 'skip'
      };
    });

    setCopyList(items);
    setIsDataLoaded(true);
  };

  // On mount: if Quick Yesterday Mode, auto-load yesterday -> today
  useEffect(() => {
    if (isQuickYesterdayMode) {
      const yesterday = getYesterdayDate(currentTargetDate);
      setSourceDate(yesterday);
      setTargetDate(currentTargetDate);
      loadSourceData(yesterday, currentTargetDate);
    } else {
      loadSourceData(sourceDate, targetDate);
    }
  }, [isQuickYesterdayMode, currentTargetDate]);

  // Handle date load button click
  const handleLoadClick = () => {
    loadSourceData(sourceDate, targetDate);
  };

  // Toggle individual item
  const toggleSelect = (patientId: string) => {
    setCopyList(prev => prev.map(item => {
      if (item.patient.id === patientId) {
        return { ...item, selected: !item.selected };
      }
      return item;
    }));
  };

  // Toggle All
  const selectAll = () => {
    setCopyList(prev => prev.map(item => ({ ...item, selected: true })));
  };

  const deselectAll = () => {
    setCopyList(prev => prev.map(item => ({ ...item, selected: false })));
  };

  // Change duplicate action
  const handleDuplicateActionChange = (patientId: string, action: 'skip' | 'replace' | 'keep_both') => {
    setCopyList(prev => prev.map(item => {
      if (item.patient.id === patientId) {
        return { 
          ...item, 
          duplicateAction: action,
          selected: action !== 'skip' // if skip, deselect; otherwise select
        };
      }
      return item;
    }));
  };

  // Generate Preview Schedule
  const generatePreview = () => {
    const selectedItems = copyList.filter(item => item.selected);

    if (selectedItems.length === 0) {
      alert('Vui lòng chọn ít nhất một người bệnh để sao chép.');
      return;
    }

    // Build list of final patients for target date
    // 1. Start with existing target patients (unless replaced)
    let finalPatients: Patient[] = [...targetExistingPatients];

    let copiedCount = 0;
    let existsCount = 0;
    let skippedCount = copyList.filter(i => !i.selected).length;

    selectedItems.forEach(item => {
      const srcPatient = item.patient;

      if (item.duplicateStatus === 'exists') {
        existsCount++;
        if (item.duplicateAction === 'replace') {
          // Remove old patient from target
          finalPatients = finalPatients.filter(
            p => p.patientId !== srcPatient.patientId && p.name.trim().toLowerCase() !== srcPatient.name.trim().toLowerCase()
          );
        }
      }

      // Create NEW patient object for Target Date ONLY
      // PHẦN III: CHỈ sao chép ID, Name, Times, OrderTime, Notes
      // KHÔNG sao chép old start/end/nurse/machine!
      const newPatientForTarget: Patient = {
        id: Math.random().toString(36).substring(2, 11),
        stt: 0, // Will reindex
        patientId: srcPatient.patientId,
        name: srcPatient.name,
        date: targetDate, // Target date!
        orderTime: srcPatient.orderTime,
        times: srcPatient.times,
        notes: srcPatient.notes || ''
      };

      finalPatients.push(newPatientForTarget);
      copiedCount++;
    });

    // Reindex STT
    finalPatients = finalPatients.map((p, idx) => ({ ...p, stt: idx + 1 }));

    // Run scheduler algorithm for target date!
    const newlyCalculatedSessions = scheduleTreatments(finalPatients, nurses, totalPatientsInDept || finalPatients.length);

    setPreviewPatients(finalPatients);
    setPreviewSessions(newlyCalculatedSessions);

    setStats({
      totalSource: copyList.length,
      copiedCount,
      existsCount,
      skippedCount
    });

    setStep('preview');
  };

  // Confirm Official Schedule Creation
  const handleConfirmOfficialSave = () => {
    // Save officially for target date in localStorage!
    saveScheduleByDate(targetDate, previewPatients, previewSessions, totalPatientsInDept || previewPatients.length);

    // Show success view
    setStep('success');
  };

  // Finish modal and sync app main view
  const handleFinish = () => {
    onSuccess(targetDate, previewPatients, previewSessions);
    onClose();
  };

  const safeFormatTime = (d: Date | string) => {
    try {
      const dateObj = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(dateObj.getTime())) return '--:--';
      return format(dateObj, 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-black">
              {isQuickYesterdayMode ? <Zap size={26} className="text-yellow-300" /> : <Copy size={26} />}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">
                {isQuickYesterdayMode ? '⚡ SAO CHÉP NGÀY HÔM QUA' : 'SAO CHÉP LỊCH PHUN KHÍ DUNG'}
              </h2>
              <p className="text-xs text-blue-200 font-medium mt-0.5">
                {step === 'config' && 'Chọn ngày nguồn, ngày đích và lựa chọn người bệnh cần sao chép'}
                {step === 'preview' && 'XEM TRƯỚC - Hệ thống đã tính lại giờ thực hiện, phân công điều dưỡng & máy'}
                {step === 'success' && '✅ ĐÃ TẠO LỊCH THÀNH CÔNG'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* STEP 1: CONFIGURATION & SELECTION */}
        {step === 'config' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
            {/* Date Picker Row */}
            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5 flex items-center gap-3">
                <label className="text-xs font-black uppercase text-slate-500 whitespace-nowrap">Ngày nguồn:</label>
                <input
                  type="date"
                  value={sourceDate}
                  onChange={(e) => setSourceDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <div className="md:col-span-1 flex justify-center text-slate-400 font-bold">
                <ArrowRight size={22} className="hidden md:block" />
              </div>

              <div className="md:col-span-4 flex items-center gap-3">
                <label className="text-xs font-black uppercase text-slate-500 whitespace-nowrap">Ngày đích:</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  onClick={handleLoadClick}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw size={15} /> Tải danh sách
                </button>
              </div>
            </div>

            {/* Selection Controls */}
            {!isDataLoaded ? (
              <div className="text-center py-12 text-slate-400 font-medium">Đang tải dữ liệu ngày nguồn...</div>
            ) : copyList.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Info size={40} className="mx-auto text-slate-300 mb-2" />
                <h3 className="text-base font-bold text-slate-700">
                  Không tìm thấy người bệnh nào vào ngày nguồn ({format(parseISO(sourceDate), 'dd/MM/yyyy')})
                </h3>
                <p className="text-xs text-slate-400 mt-1">Vui lòng kiểm tra lại ngày nguồn hoặc chọn ngày khác.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                  <div className="text-xs font-bold text-blue-900">
                    Danh sách người bệnh ngày nguồn ({format(parseISO(sourceDate), 'dd/MM/yyyy')}):{' '}
                    <span className="font-black text-blue-700">{copyList.length} người bệnh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAll}
                      className="bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <CheckSquare size={14} /> Chọn tất cả
                    </button>
                    <button
                      onClick={deselectAll}
                      className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Square size={14} /> Bỏ chọn tất cả
                    </button>
                  </div>
                </div>

                {/* Patient Selection List */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white divide-y divide-slate-100">
                  {copyList.map((item, index) => {
                    const p = item.patient;
                    return (
                      <div 
                        key={p.id} 
                        className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
                          item.selected ? 'bg-blue-50/20' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 flex-1 cursor-pointer" onClick={() => toggleSelect(p.id)}>
                          <input 
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleSelect(p.id)}
                            className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-sm uppercase">{p.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{p.patientId}</span>
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                                {p.times} lần/ngày
                              </span>
                              <span className="text-xs font-medium text-slate-500">
                                (Y lệnh: {p.orderTime})
                              </span>
                            </div>

                            {/* Duplicate Warning & Options */}
                            {item.duplicateStatus === 'exists' && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                                <span>
                                  <strong>⚠️ NGƯỜI BỆNH ĐÃ TỒN TẠI:</strong> {p.name} đã có trong lịch ngày {format(parseISO(targetDate), 'dd/MM/yyyy')}.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Duplicate Handling Select */}
                        {item.duplicateStatus === 'exists' && (
                          <div className="flex items-center gap-2 text-xs shrink-0">
                            <span className="font-bold text-slate-500">Xử lý:</span>
                            <select
                              value={item.duplicateAction}
                              onChange={(e) => handleDuplicateActionChange(p.id, e.target.value as any)}
                              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="skip">Bỏ qua (Khuyên dùng)</option>
                              <option value="replace">Thay thế dữ liệu cũ</option>
                              <option value="keep_both">Thêm mới (Giữ cả hai)</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 2: PREVIEW SCREEN (GIAO DIỆN XEM TRƯỚC) */}
        {step === 'preview' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
            {/* Header Info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">DANH SÁCH NGƯỜI BỆNH SAO CHÉP (XEM TRƯỚC)</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Ngày nguồn: <span className="font-bold text-blue-700">{format(parseISO(sourceDate), 'dd/MM/yyyy')}</span> ➔ Ngày đích: <span className="font-bold text-emerald-700">{format(parseISO(targetDate), 'dd/MM/yyyy')}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
                  Tổng nguồn: <strong>{stats.totalSource}</strong>
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200">
                  Được sao chép: <strong>{stats.copiedCount}</strong>
                </span>
                {stats.existsCount > 0 && (
                  <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-xl border border-amber-200">
                    Đã tồn tại: <strong>{stats.existsCount}</strong>
                  </span>
                )}
                {stats.skippedCount > 0 && (
                  <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl border border-slate-200">
                    Bỏ qua: <strong>{stats.skippedCount}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Reassignment Rule Reminder Banner */}
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-emerald-900">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Quy tắc lập lịch tự động:</strong> Giờ thực hiện = Giờ Y lệnh + 8 phút. Giờ kết thúc = Giờ thực hiện + 20 phút. Điều dưỡng và máy đã được hệ thống phân công lại hoàn toàn độc lập cho ngày {format(parseISO(targetDate), 'dd/MM/yyyy')}.
              </div>
            </div>

            {/* Preview Schedule Table */}
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
                    <th className="py-3 px-4 border-r border-slate-200">ĐIỀU DƯỠNG MỚI</th>
                    <th className="py-3 px-3 text-center w-20 border-r border-slate-200">MÁY MỚI</th>
                    <th className="py-3 px-4">GHI CHÚ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
                  {previewSessions.map((s, idx) => (
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
                      <td className="py-3 px-4 font-bold text-indigo-900 border-r border-slate-200 bg-indigo-50/30">{s.nurseName}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700 border-r border-slate-200 bg-indigo-50/30">
                        <span className="px-2 py-0.5 bg-indigo-100 rounded border border-indigo-200">
                          {s.machineCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 italic">{s.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION SCREEN */}
        {step === 'success' && (
          <div className="flex-1 overflow-y-auto p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={48} />
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">✅ ĐÃ TẠO LỊCH THÀNH CÔNG</h3>
              <p className="text-sm font-medium text-slate-600 mt-1">
                Lịch phun khí dung cho ngày <strong>{format(parseISO(targetDate), 'dd/MM/yyyy')}</strong> đã được lưu chính thức.
              </p>
            </div>

            <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left text-xs space-y-2 text-slate-700">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Ngày nguồn:</span>
                <span className="font-bold">{format(parseISO(sourceDate), 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Ngày đích:</span>
                <span className="font-bold text-emerald-700">{format(parseISO(targetDate), 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Số người bệnh sao chép:</span>
                <span className="font-black text-emerald-600">{stats.copiedCount} người bệnh</span>
              </div>
              {stats.existsCount > 0 && (
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Đã tồn tại:</span>
                  <span className="font-bold text-amber-600">{stats.existsCount}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="text-slate-500 font-medium">Lượt phun được tạo:</span>
                <span className="font-black text-indigo-600">{previewSessions.length} lượt</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 italic">
              * Dữ liệu ngày nguồn ({format(parseISO(sourceDate), 'dd/MM/yyyy')}) được bảo toàn hoàn toàn không bị ảnh hưởng.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-6 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-4">
          {step === 'config' && (
            <>
              <button
                onClick={onClose}
                className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={generatePreview}
                disabled={!isDataLoaded || copyList.filter(i => i.selected).length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                🚀 Sao chép và tạo lịch
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('config')}
                className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Quay lại
              </button>
              <button
                onClick={handleConfirmOfficialSave}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                🚀 Tạo lịch chính thức
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="w-full flex justify-end">
              <button
                onClick={handleFinish}
                className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} /> Bắt đầu xem lịch mới
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

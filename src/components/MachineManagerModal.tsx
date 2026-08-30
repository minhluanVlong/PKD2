import React, { useState } from 'react';
import { Nurse } from '../lib/scheduler';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  RotateCcw, 
  Cpu, 
  CheckCircle2, 
  AlertCircle,
  Stethoscope,
  Sparkles,
  UserCheck,
  Undo2
} from 'lucide-react';
import { DEFAULT_MACHINES } from '../lib/dateStorage';

interface MachineManagerModalProps {
  machines: string[];
  nurses: Nurse[];
  onSaveMachines: (newMachines: string[]) => void;
  onUpdateNurses: (newNurses: Nurse[]) => void;
  onClose: () => void;
}

export const MachineManagerModal: React.FC<MachineManagerModalProps> = ({
  machines,
  nurses,
  onSaveMachines,
  onUpdateNurses,
  onClose
}) => {
  const [machineList, setMachineList] = useState<string[]>(machines);
  const [newCode, setNewCode] = useState<string>('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [lastDeletedMachine, setLastDeletedMachine] = useState<{ code: string; index: number } | null>(null);

  const getMachineColor = (code: string) => {
    const colorMap: { [key: string]: string } = {
      '032': '#2563eb', // blue
      '121': '#7c3aed', // purple
      '368': '#db2777', // pink
      '001': '#059669', // emerald
      '002': '#d97706', // amber
      '003': '#dc2626', // red
      '004': '#0891b2', // cyan
      '005': '#ea580c', // orange
    };
    if (colorMap[code]) return colorMap[code];
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706', '#dc2626', '#0891b2', '#ea580c', '#0284c7', '#9333ea'];
    return colors[Math.abs(hash) % colors.length];
  };

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = newCode.trim();
    if (!raw) {
      setErrorMsg('Vui lòng nhập mã máy (ví dụ: 045 hoặc 045, 089, PKD-01).');
      return;
    }

    // Support comma or whitespace separated codes
    const candidates = raw
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (candidates.length === 0) {
      setErrorMsg('Vui lòng nhập mã máy hợp lệ.');
      return;
    }

    const added: string[] = [];
    const duplicates: string[] = [];
    const updated = [...machineList];

    for (const code of candidates) {
      if (updated.some(m => m.toLowerCase() === code.toLowerCase())) {
        duplicates.push(code);
      } else {
        updated.push(code);
        added.push(code);
      }
    }

    if (added.length === 0 && duplicates.length > 0) {
      setErrorMsg(`Mã máy "${duplicates.join(', ')}" đã có trong danh sách.`);
      return;
    }

    setMachineList(updated);
    onSaveMachines(updated);
    setNewCode('');
    setErrorMsg('');

    let msg = `Đã thêm ${added.length} mã máy: ${added.join(', ')}.`;
    if (duplicates.length > 0) {
      msg += ` (Bỏ qua mã đã tồn tại: ${duplicates.join(', ')})`;
    }
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleQuickAdd = (code: string) => {
    if (machineList.some(m => m.toLowerCase() === code.toLowerCase())) {
      setErrorMsg(`Mã máy "${code}" đã có trong danh sách.`);
      return;
    }
    const updated = [...machineList, code];
    setMachineList(updated);
    onSaveMachines(updated);
    setErrorMsg('');
    setSuccessMsg(`Đã thêm mã máy "${code}".`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(machineList[index]);
    setDeleteConfirmIndex(null);
    setErrorMsg('');
  };

  const handleSaveEdit = (index: number) => {
    const oldCode = machineList[index];
    const trimmed = editValue.trim();
    if (!trimmed) {
      setErrorMsg('Mã máy không được để trống.');
      return;
    }

    if (trimmed !== oldCode && machineList.some((m, i) => i !== index && m.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Mã máy "${trimmed}" đã tồn tại.`);
      return;
    }

    const updated = [...machineList];
    updated[index] = trimmed;
    setMachineList(updated);
    onSaveMachines(updated);

    // If any nurse was using the old code, update to new code
    const updatedNurses = nurses.map(n => {
      if (n.machineCode === oldCode) {
        return { ...n, machineCode: trimmed };
      }
      return n;
    });
    onUpdateNurses(updatedNurses);

    setEditingIndex(null);
    setEditValue('');
    setErrorMsg('');
    setSuccessMsg(`Đã cập nhật mã máy thành "${trimmed}".`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Safe delete without window.confirm (never blocked by iframe restrictions)
  const handleExecuteDelete = (index: number) => {
    const codeToDelete = machineList[index];
    const assignedNurse = nurses.find(n => n.machineCode === codeToDelete);

    const updated = machineList.filter((_, i) => i !== index);
    setMachineList(updated);
    onSaveMachines(updated);

    // Reassign nurse if they were using the deleted machine
    if (assignedNurse && updated.length > 0) {
      const updatedNurses = nurses.map(n => {
        if (n.machineCode === codeToDelete) {
          return { ...n, machineCode: updated[0] };
        }
        return n;
      });
      onUpdateNurses(updatedNurses);
    }

    setLastDeletedMachine({ code: codeToDelete, index });
    setDeleteConfirmIndex(null);
    setErrorMsg('');
    setSuccessMsg(`Đã xóa mã máy "${codeToDelete}".`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleUndoDelete = () => {
    if (!lastDeletedMachine) return;
    const { code, index } = lastDeletedMachine;
    const updated = [...machineList];
    updated.splice(index, 0, code);
    setMachineList(updated);
    onSaveMachines(updated);
    setLastDeletedMachine(null);
    setSuccessMsg(`Đã khôi phục lại mã máy "${code}".`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleExecuteResetDefault = () => {
    setMachineList(DEFAULT_MACHINES);
    onSaveMachines(DEFAULT_MACHINES);
    
    // Update nurses to match defaults
    const updatedNurses = nurses.map((n, i) => ({
      ...n,
      machineCode: DEFAULT_MACHINES[i % DEFAULT_MACHINES.length]
    }));
    onUpdateNurses(updatedNurses);

    setShowResetConfirm(false);
    setErrorMsg('');
    setSuccessMsg('Đã khôi phục danh sách mã máy mặc định (032, 121, 368).');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAssignMachineToNurse = (nurseIndex: number, machineCode: string) => {
    const updated = [...nurses];
    updated[nurseIndex].machineCode = machineCode;
    onUpdateNurses(updated);
    setSuccessMsg(`Đã phân công máy "${machineCode}" cho ${updated[nurseIndex].name}.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200 flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-black shrink-0 border border-blue-400/20">
              <Cpu size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">QUẢN LÝ MÃ MÁY PHUN KHÍ DUNG</h2>
              <p className="text-[11px] sm:text-xs text-blue-200 font-medium mt-0.5">
                Thêm mới, chỉnh sửa, xóa mã máy và phân công máy cho khoa
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Status Alerts */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-800 font-black cursor-pointer">✕</button>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
              <div className="flex items-center gap-2">
                {lastDeletedMachine && (
                  <button
                    type="button"
                    onClick={handleUndoDelete}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                  >
                    <Undo2 size={13} /> Hoàn tác
                  </button>
                )}
                <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 font-black cursor-pointer">✕</button>
              </div>
            </div>
          )}

          {/* Quick Add Form */}
          <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <Plus size={15} className="text-blue-600" /> Thêm mã máy mới vào khoa
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Nhập nhiều mã cách nhau bằng dấu phẩy (,)</span>
            </div>

            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="text"
                placeholder="VD: 045, 089, PKD-04..."
                value={newCode}
                onChange={(e) => {
                  setNewCode(e.target.value);
                  setErrorMsg('');
                }}
                className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer shrink-0"
              >
                <Plus size={16} /> Thêm máy
              </button>
            </form>

            {/* Quick suggestion chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Sparkles size={12} className="text-amber-500" /> Gợi ý nhanh:
              </span>
              {['032', '121', '368', '045', '089', 'PKD-01', 'PKD-02', 'PKD-03'].map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickAdd(chip)}
                  disabled={machineList.includes(chip)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    machineList.includes(chip)
                      ? 'bg-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                      : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white shadow-sm'
                  }`}
                >
                  +{chip}
                </button>
              ))}
            </div>
          </div>

          {/* Current Machines List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-2">
                Danh sách máy của khoa ({machineList.length} máy)
              </h3>
              
              {!showResetConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="text-[11px] font-bold text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Khôi phục danh sách máy mặc định ban đầu"
                >
                  <RotateCcw size={12} /> Khôi phục mặc định
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl animate-in fade-in">
                  <span className="text-[11px] font-bold text-red-700">Khôi phục (032, 121, 368)?</span>
                  <button
                    type="button"
                    onClick={handleExecuteResetDefault}
                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    Đồng ý
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {machineList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Khoa chưa có mã máy nào. Vui lòng nhập mã máy ở phía trên.
                </div>
              ) : (
                machineList.map((code, index) => {
                  const assignedNurse = nurses.find(n => n.machineCode === code);
                  const isEditing = editingIndex === index;
                  const isConfirmingDelete = deleteConfirmIndex === index;

                  return (
                    <div
                      key={`${code}-${index}`}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        isConfirmingDelete 
                          ? 'bg-red-50/80 border-red-300 shadow-sm' 
                          : isEditing
                          ? 'bg-blue-50/50 border-blue-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      {isConfirmingDelete ? (
                        /* Direct in-card Delete Confirmation (No window.confirm needed) */
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
                          <div className="flex items-center gap-2.5 text-red-800">
                            <AlertCircle size={18} className="text-red-600 shrink-0" />
                            <div>
                              <div className="text-xs font-bold">
                                Bạn có chắc chắn muốn xóa mã máy <span className="font-mono font-black text-red-900 bg-red-100 px-1.5 py-0.5 rounded">{code}</span>?
                              </div>
                              {assignedNurse && (
                                <div className="text-[11px] text-red-600 mt-0.5 font-medium">
                                  ⚠️ Máy này đang được giao cho: <strong>{assignedNurse.name}</strong>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleExecuteDelete(index)}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                            >
                              <Trash2 size={14} /> Chắc chắn xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmIndex(null)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                            >
                              Hủy bỏ
                            </button>
                          </div>
                        </div>
                      ) : isEditing ? (
                        /* Inline Edit Mode */
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: getMachineColor(editValue || code) }}
                          />
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(index);
                              if (e.key === 'Escape') setEditingIndex(null);
                            }}
                            className="flex-1 px-3 py-1.5 bg-white border-2 border-blue-500 rounded-xl text-sm font-bold text-slate-900 focus:outline-none shadow-sm"
                            placeholder="Nhập mã máy mới..."
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(index)}
                            className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer transition-colors shadow-sm"
                            title="Lưu thay đổi (Enter)"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl cursor-pointer transition-colors"
                            title="Hủy bỏ (Esc)"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        /* Normal Display Row */
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span
                              className="w-4 h-4 rounded-full shrink-0 shadow-sm ring-2 ring-white"
                              style={{ backgroundColor: getMachineColor(code) }}
                            />

                            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                              <span className="font-mono font-black text-slate-900 text-base sm:text-lg tracking-tight">
                                {code}
                              </span>

                              {assignedNurse ? (
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <UserCheck size={12} className="text-blue-600" /> {assignedNurse.name}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                  Khoa / Dự phòng
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Edit, Delete */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(index)}
                              className="px-2.5 py-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-transparent hover:border-blue-200"
                              title="Chỉnh sửa mã máy"
                            >
                              <Edit2 size={14} /> Sửa
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteConfirmIndex(index);
                                setEditingIndex(null);
                              }}
                              className="px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-transparent hover:border-red-200"
                              title="Xóa mã máy"
                            >
                              <Trash2 size={14} /> Xóa
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Nurse Assignment Section */}
          <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/60 border border-indigo-100 p-4 sm:p-5 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black uppercase text-indigo-950 flex items-center gap-2 tracking-wider">
                <Stethoscope size={16} className="text-indigo-600" /> Phân công nhanh máy cho Điều dưỡng
              </div>
              <span className="text-[10px] text-indigo-600 font-bold">3 Điều dưỡng trực</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {nurses.map((nurse, nIdx) => (
                <div key={nurse.id} className="bg-white p-3 rounded-2xl border border-indigo-100/80 shadow-sm space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500">
                    {nIdx === 2 ? 'ĐD Hành chính' : `ĐD Trực ${nIdx === 0 ? 'A' : 'B'}`}
                  </div>
                  <div className="font-bold text-xs text-slate-800 truncate" title={nurse.name}>
                    {nurse.name}
                  </div>
                  <div className="pt-1">
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Mã máy phụ trách:</label>
                    <select
                      value={nurse.machineCode}
                      onChange={(e) => handleAssignMachineToNurse(nIdx, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-mono font-black text-xs text-blue-900 outline-none focus:ring-2 ring-blue-500/20 cursor-pointer"
                    >
                      {machineList.map(m => (
                        <option key={m} value={m}>Máy {m}</option>
                      ))}
                      {!machineList.includes(nurse.machineCode) && (
                        <option value={nurse.machineCode}>Máy {nurse.machineCode}</option>
                      )}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">
            Tổng cộng: <strong className="text-slate-900">{machineList.length} máy</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white px-7 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
          >
            Hoàn tất & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

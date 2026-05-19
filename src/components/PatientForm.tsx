import React from 'react';
import { Patient } from '../lib/scheduler';
import { X, Plus } from 'lucide-react';

interface PatientFormProps {
  onClose: () => void;
  onSubmit: (patient: Patient) => void;
  initialData?: Patient;
}

export const PatientForm: React.FC<PatientFormProps> = ({ onClose, onSubmit, initialData }) => {
  const [formData, setFormData] = React.useState<Partial<Patient>>(
    initialData || {
      name: '',
      patientId: '',
      date: new Date().toISOString().split('T')[0],
      orderTime: '08:00',
      times: 1,
      notes: ''
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData as Patient,
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      stt: initialData?.stt || 0,
    });
  };

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center justify-between p-8 border-b border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {initialData ? 'Sửa thông tin' : 'Thêm bệnh nhân'}
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Cài đặt lịch khí dung mới</p>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-slate-50 text-slate-400 rounded-full transition-colors group">
          <X size={24} className="group-hover:rotate-90 transition-transform" />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="space-y-6">
          <div className="group">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Họ và tên bệnh nhân</label>
            <input
              required
              autoFocus
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-hospital-accent focus:bg-white outline-none font-bold text-slate-700 transition-all placeholder:font-normal"
              placeholder="VD: Nguyễn Văn An"
            />
          </div>
          
          <div className="group">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Mã số hồ sơ (ID)</label>
            <input
              required
              type="text"
              value={formData.patientId}
              onChange={e => setFormData({ ...formData, patientId: e.target.value })}
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-hospital-accent focus:bg-white outline-none font-mono font-bold text-slate-600 transition-all"
              placeholder="VD: BN001"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="group">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Ngày chỉ định</label>
              <input
                required
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-hospital-accent focus:bg-white outline-none font-bold text-slate-600 transition-all"
              />
            </div>
            <div className="group">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Giờ y lệnh đầu</label>
              <input
                required
                type="time"
                value={formData.orderTime}
                onChange={e => setFormData({ ...formData, orderTime: e.target.value })}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-hospital-accent focus:bg-white outline-none font-bold text-slate-600 transition-all"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Tần suất phun (Lần/Ngày)</label>
            <div className="flex gap-3">
              {[1, 2, 3].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFormData({ ...formData, times: t })}
                  className={`flex-1 py-4 rounded-2xl font-black transition-all border-2 ${
                    formData.times === t 
                    ? 'bg-hospital-accent border-hospital-accent text-white shadow-lg shadow-hospital-accent/20' 
                    : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {t} LẦN
                </button>
              ))}
            </div>
          </div>

          <div className="group">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Ghi chú lâm sàng</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-hospital-accent focus:bg-white outline-none font-bold text-slate-600 transition-all min-h-[100px] placeholder:font-normal"
              placeholder="VD: Hen suyễn cấp, tránh kích ứng..."
            />
          </div>
        </div>

        <div className="pt-4 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black hover:bg-slate-200 transition-all uppercase text-xs tracking-widest"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            className="flex-[2] px-6 py-4 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
          >
            {initialData ? 'Lưu thay đổi' : 'Xác nhận thêm'}
          </button>
        </div>
      </form>
    </div>
  );
};

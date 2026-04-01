export default function ConfirmModal({ message, onConfirm, onCancel, confirmText = 'Подтвердить', danger = false }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <p style={{ color:'var(--white)', fontSize:'0.95rem', lineHeight:1.6, marginBottom:20 }}>{message}</p>
        <div className="modal-btns-row">
          <button
            className={danger ? 'btn-primary' : 'btn-primary'}
            style={danger ? { background:'var(--red)' } : {}}
            onClick={onConfirm}
          >{confirmText}</button>
          <button className="btn-outline" onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

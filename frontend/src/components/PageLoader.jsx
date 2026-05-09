import './PageLoader.css'

export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Загрузка">
      <div className="page-loader-spinner" />
    </div>
  )
}

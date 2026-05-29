
export function Layout({ children }: {children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl p-5">
      {children}
    </div>
  )
}
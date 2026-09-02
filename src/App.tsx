import { useEffect, useState } from 'react'
import type { AppView, Phenotype } from './types'
import { userPhenotype as seedPhenotype } from './data/mock'
import { fetchHealth, fetchPhenotype } from './api/client'
import { PhenoView } from './components/PhenoView'
import { MatchView } from './components/MatchView'
import { NavBar } from './components/NavBar'
import './App.css'

function App() {
  const [view, setView] = useState<AppView>('pheno')
  const [hasProfile, setHasProfile] = useState(false)
  const [phenotype, setPhenotype] = useState<Phenotype>(seedPhenotype)
  const [apiLabel, setApiLabel] = useState('matching API')

  useEffect(() => {
    void fetchPhenotype().then(setPhenotype)
    void fetchHealth().then((health) => {
      if (!health) {
        setApiLabel('API offline')
        return
      }
      setApiLabel(`${health.gcp.projectId} · ${health.gcp.mode}`)
    })
  }, [])

  return (
    <div className="app">
      <div className="app__phone">
        <header className="app__status-bar">
          <span aria-hidden="true">9:41</span>
          <span className="app__logo">PhenoMatch</span>
          <span className="app__cloud-tag">{apiLabel}</span>
        </header>

        <main className="app__main">
          {view === 'pheno' && (
            <PhenoView
              phenotype={phenotype}
              hasProfile={hasProfile}
              onScanComplete={(result) => {
                setPhenotype(result)
                setHasProfile(true)
              }}
            />
          )}
          {view === 'match' && (
            <MatchView hasProfile={hasProfile} phenotype={phenotype} />
          )}
        </main>

        <NavBar current={view} onNavigate={setView} />
      </div>
    </div>
  )
}

export default App

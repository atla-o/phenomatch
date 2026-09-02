import { useEffect, useState } from 'react'
import type { AppView, Phenotype } from './types'
import { userPhenotype as seedPhenotype } from './data/mock'
import { fetchPhenotype } from './api/client'
import { PhenoView } from './components/PhenoView'
import { MatchView } from './components/MatchView'
import { NavBar } from './components/NavBar'
import './App.css'

function App() {
  const [view, setView] = useState<AppView>('pheno')
  const [hasProfile, setHasProfile] = useState(false)
  const [phenotype, setPhenotype] = useState<Phenotype>(seedPhenotype)

  useEffect(() => {
    void fetchPhenotype().then(setPhenotype)
  }, [])

  return (
    <div className="app">
      <div className="app__phone">
        <header className="app__status-bar">
          <span className="app__logo">PhenoMatch</span>
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
              onGeneLinked={setPhenotype}
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

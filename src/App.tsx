import { useState } from 'react'
import type { AppView } from './types'
import { matches, userPhenotype } from './data/mock'
import { PhenoView } from './components/PhenoView'
import { MatchView } from './components/MatchView'
import { NavBar } from './components/NavBar'
import './App.css'

function App() {
  const [view, setView] = useState<AppView>('pheno')
  const [hasProfile, setHasProfile] = useState(false)

  return (
    <div className="app">
      <div className="app__phone">
        <header className="app__status-bar" aria-hidden="true">
          <span>9:41</span>
          <span className="app__logo">PhenoMatch</span>
          <span>●●●</span>
        </header>

        <main className="app__main">
          {view === 'pheno' && (
            <PhenoView
              phenotype={userPhenotype}
              hasProfile={hasProfile}
              onScanComplete={() => setHasProfile(true)}
            />
          )}
          {view === 'match' && (
            <MatchView matches={matches} hasProfile={hasProfile} />
          )}
        </main>

        <NavBar current={view} onNavigate={setView} />
      </div>
    </div>
  )
}

export default App

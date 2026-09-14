import { useEffect, useState } from 'react'
import type { AppView, MatchCategory, Phenotype } from './types'
import { userPhenotype as seedPhenotype } from './data/mock'
import { fetchIceServers, fetchPhenotype } from './api/client'
import { loadProfile, saveProfile } from './storage'
import { PhenoView } from './components/PhenoView'
import { MatchView } from './components/MatchView'
import { NavBar } from './components/NavBar'
import './App.css'

function readUmingleRedirect(): { view: AppView; matchCategory: MatchCategory } {
  if (typeof window === 'undefined') return { view: 'pheno', matchCategory: 'data' }
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const hash = window.location.hash.replace(/^#/, '')
  if (path === '/umingle' || hash === 'umingle' || hash === 'anon') {
    window.history.replaceState(null, '', '/')
    return { view: 'match', matchCategory: 'anonymous' }
  }
  return { view: 'pheno', matchCategory: 'data' }
}

function App() {
  const [boot] = useState(readUmingleRedirect)
  const [view, setView] = useState<AppView>(boot.view)
  const [matchCategory, setMatchCategory] = useState<MatchCategory>(boot.matchCategory)
  const [hasProfile, setHasProfile] = useState(() => Boolean(loadProfile()?.hasProfile))
  const [phenotype, setPhenotype] = useState<Phenotype>(
    () => loadProfile()?.phenotype ?? seedPhenotype,
  )

  useEffect(() => {
    saveProfile({ hasProfile, phenotype })
  }, [hasProfile, phenotype])

  useEffect(() => {
    void fetchIceServers()
  }, [])

  useEffect(() => {
    void fetchPhenotype().then((result) => {
      if (result.hasProfile) {
        setHasProfile(true)
        setPhenotype(result.phenotype)
        return
      }
      if (!hasProfile) {
        setPhenotype(result.phenotype)
      }
    })
  }, [hasProfile])

  return (
    <div className="app">
      <div className="app__phone">
        <header className="app__status-bar">
          <a className="app__logo" href="https://devoutshaman.com" aria-label="devoutshaman.com">o</a>
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
              onGoMatch={() => {
                setMatchCategory('data')
                setView('match')
              }}
            />
          )}
          {view === 'match' && (
            <MatchView
              hasProfile={hasProfile}
              phenotype={phenotype}
              category={matchCategory}
              onCategoryChange={setMatchCategory}
              onGoPheno={() => setView('pheno')}
            />
          )}
        </main>

        <NavBar current={view} onNavigate={setView} />
      </div>
    </div>
  )
}

export default App

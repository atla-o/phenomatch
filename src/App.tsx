import { useEffect, useState } from 'react'
import type { AppView, Phenotype } from './types'
import { userPhenotype as seedPhenotype } from './data/mock'
import { fetchPhenotype } from './api/client'
import { loadProfile, saveProfile } from './storage'
import { PhenoView } from './components/PhenoView'
import { MatchView } from './components/MatchView'
import { UmingleView } from './components/UmingleView'
import { NavBar } from './components/NavBar'
import './App.css'

function App() {
  const [view, setView] = useState<AppView>('pheno')
  const [hasProfile, setHasProfile] = useState(() => Boolean(loadProfile()?.hasProfile))
  const [phenotype, setPhenotype] = useState<Phenotype>(
    () => loadProfile()?.phenotype ?? seedPhenotype,
  )

  useEffect(() => {
    saveProfile({ hasProfile, phenotype })
  }, [hasProfile, phenotype])

  useEffect(() => {
    void fetchPhenotype().then((next) => {
      setPhenotype((current) => {
        if (!hasProfile) return next
        return {
          ...next,
          ...current,
          geneLinked: current.geneLinked || next.geneLinked,
          geneFileName: current.geneFileName || next.geneFileName,
          genealogyLineage: current.geneFileName
            ? current.genealogyLineage
            : next.genealogyLineage,
          genealogyLikelihood: Math.max(current.genealogyLikelihood, next.genealogyLikelihood),
        }
      })
    })
  }, [hasProfile])

  return (
    <div className="app">
      <div className="app__phone">
        <header className="app__status-bar">
          <span className="app__logo">o</span>
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
              onGoMatch={() => setView('match')}
            />
          )}
          {view === 'match' && (
            <MatchView
              hasProfile={hasProfile}
              phenotype={phenotype}
              onGoPheno={() => setView('pheno')}
            />
          )}
          {view === 'umingle' && (
            <UmingleView
              hasProfile={hasProfile}
              phenotype={phenotype}
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

<script>
  import { Router, Route, navigate } from 'svelte-routing'
  import { authStore, isReviewer, isManager, isResearcher } from './lib/store.js'
  import MobileAnnotation from './routes/MobileAnnotation.svelte'
  import Navbar from './components/Navbar.svelte'
  import Login from './routes/Login.svelte'
  import Dashboard from './routes/Dashboard.svelte'
  import Annotation from './routes/Annotation.svelte'
  import AudioList from './routes/AudioList.svelte'
  import Tasks from './routes/Tasks.svelte'
  import DialectTree from './routes/DialectTree.svelte'
  import PronunciationCompare from './routes/PronunciationCompare.svelte'
  import BatchCorrection from './routes/BatchCorrection.svelte'
  import QualityCheck from './routes/QualityCheck.svelte'
  import ResearchPortal from './routes/ResearchPortal.svelte'
  
  export let url = ''
</script>

<Router url={url}>
  {#if $authStore.isAuthenticated}
    <Navbar />
    <main>
      <Route path="/">
        <Dashboard />
      </Route>
      <Route path="/annotation">
        <Annotation />
      </Route>
      <Route path="/audio">
        <AudioList />
      </Route>
      <Route path="/tasks">
        <Tasks />
      </Route>
      <Route path="/dialect-tree">
        <DialectTree />
      </Route>
      <Route path="/pronunciation">
        <PronunciationCompare />
      </Route>
      {#if $isReviewer || $isManager}
        <Route path="/correction">
          <BatchCorrection />
        </Route>
        <Route path="/quality-check">
          <QualityCheck />
        </Route>
      {/if}
      {#if $isResearcher || $isManager}
        <Route path="/research">
          <ResearchPortal />
        </Route>
      {/if}
      <Route path="/mobile-annotate">
        <MobileAnnotation />
      </Route>
    </main>
  {:else}
    <Route path="/">
      <Login />
    </Route>
  {/if}
</Router>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }
  
  :global(*) {
    box-sizing: border-box;
  }
  
  main {
    min-height: calc(100vh - 64px);
  }
</style>

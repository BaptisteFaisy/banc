/**
 * Assemblage du site public : une page, treize sections, un pied de page.
 */
import Demo from './sections/demo';
import { DemoProvider } from './demo-context';
import Drift from './sections/drift';
import Footer from './sections/footer';
import Gate from './sections/gate';
import Gauges from './sections/gauges';
import Hero from './sections/hero';
import Honesty from './sections/honesty';
import Judges from './sections/judges';
import Nav from './sections/nav';
import Oracles from './sections/oracles';
import Problem from './sections/problem';
import Screens from './sections/screens';
import Stability from './sections/stability';
import Vision from './sections/vision';
import RealRun from './sections/real-run';

export default function App() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <DemoProvider>
        <Nav />
        <main id="main" className="main">
        <Hero />
        <Problem />
        <Oracles />
        <Drift />
        <Gauges />
        <Stability />
        <Gate />
        <RealRun />
        <Vision />
        <Screens />
        <Demo />
        <Honesty />
        <Judges />
        </main>
        <Footer />
      </DemoProvider>
    </>
  );
}

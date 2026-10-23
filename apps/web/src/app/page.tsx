import { HomeIntro } from "../shared/info/home-intro";
import { HomePreview } from "../shared/info/home-preview";

export default function HomePage() {
  return (
    <section aria-labelledby="overview-title" className="mb-24" id="overview">
      <HomeIntro />
      <HomePreview />
    </section>
  );
}

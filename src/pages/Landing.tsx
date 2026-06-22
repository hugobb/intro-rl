import { Link } from "react-router-dom";

const EXAMPLES = [
  {
    path: "/multi-armed-bandit",
    title: "Multi-Armed Bandit",
    blurb: "Find the best poutine in Montréal. Random, greedy, optimistic init, and ε-greedy policies.",
  },
];

export function Landing() {
  return (
    <div className="app">
      <h1>Intro to Reinforcement Learning</h1>
      <p>Interactive demos for the lecture.</p>
      <ul>
        {EXAMPLES.map((e) => (
          <li key={e.path}>
            <Link to={e.path}>{e.title}</Link> — {e.blurb}
          </li>
        ))}
      </ul>
    </div>
  );
}

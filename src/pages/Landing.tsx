import { Link } from "react-router-dom";

const EXAMPLES = [
  {
    path: "/multi-armed-bandit",
    title: "Multi-Armed Bandit",
    blurb: "Find the best poutine in Montréal. Random, greedy, optimistic init, and ε-greedy policies.",
  },
  {
    path: "/grid-world",
    title: "Grid World — Policy Evaluation",
    blurb:
      "Help a character reach Chez Claudette. Estimate V(s) for a fixed policy with Monte Carlo, TD(0), and n-step TD.",
  },
];

export function Landing() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1>Intro to Reinforcement Learning</h1>
      <p>Interactive demos for the lecture.</p>
      <ul className="grid gap-2">
        {EXAMPLES.map((e) => (
          <li key={e.path}>
            <Link to={e.path}>{e.title}</Link> — {e.blurb}
          </li>
        ))}
      </ul>
    </div>
  );
}

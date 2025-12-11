import { Linkedin } from 'lucide-react';

const team = [
  {
    name: 'Jeferson Komati',
    role: 'CEO & Co-founder',
    bio: 'Empreendedor serial com experiência em fintechs e automação empresarial.',
    linkedin: 'https://linkedin.com/in/jefersonkomati',
  },
  {
    name: 'Oscar Moura',
    role: 'CTO & Co-founder',
    bio: 'Engenheiro de software com expertise em IA e sistemas distribuídos.',
    linkedin: 'https://linkedin.com/in/oscarmoura',
  },
];

export function TeamSection() {
  return (
    <section id="team" className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-4 uppercase tracking-wider text-sm">
            Time
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Quem está por trás do KingYouBe
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Uma equipe apaixonada por transformar a gestão financeira
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {team.map((member, index) => (
            <div
              key={index}
              className="group relative p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 text-center"
            >
              {/* Avatar placeholder */}
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-foreground mb-1">
                {member.name}
              </h3>
              <p className="text-primary text-sm font-medium mb-3">
                {member.role}
              </p>
              <p className="text-muted-foreground text-sm mb-4">
                {member.bio}
              </p>

              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

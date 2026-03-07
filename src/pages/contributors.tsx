import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Github, Twitter, Globe, CodeXml, ShieldCheck, Sparkles, Instagram, Linkedin, Link as LinkIcon } from "lucide-react";

// --- CONTRIBUTORS JSON DATA ---
const CONTRIBUTORS_DATA = [
  {
    id: "1",
    name: "Ramswaroop Patel [RPx]",
    role: "admin",
    title: "Lead Developer & Creator",
    description: "Architecting the core infrastructure and designing the modern glassy aesthetic of ShareHub4U.",
    avatar: "https://pbs.twimg.com/profile_images/1972647888145842176/w3SAwZnS_400x400.jpg",
    socials: {
      github: "https://github.com/ramswarooppatel",
      twitter: "https://x.com/ramswaroop_og",
      instagram: "https://instagram.com/ramswaroop03",
      linkedin: "https://linkedin.com/in/ramswarooppatel",
      portfolio: "https://ramswaroop.vercel.app"
    }
  }
];

const Contributors = () => {
  const navigate = useNavigate();

  // Separate the admin from the rest of the contributors
  const admin = CONTRIBUTORS_DATA.find((c) => c.role === "admin");
  const contributors = CONTRIBUTORS_DATA.filter((c) => c.role !== "admin");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans selection:bg-primary/30 relative overflow-x-hidden pb-20">
      
      {/* Soft Ambient Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* GLASSY HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/60 dark:bg-zinc-950/60 backdrop-blur-2xl border-b border-white/10 shadow-sm supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Button 
            onClick={() => navigate(-1)} 
            variant="ghost" 
            className="rounded-full px-4 h-10 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all text-muted-foreground hover:text-foreground font-bold"
          >
            <ArrowLeft className="h-5 w-5 mr-2" /> Back
          </Button>
          
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/40 dark:bg-white/5 border border-white/20 shadow-inner backdrop-blur-md">
            <CodeXml className="h-4 w-4 text-primary" />
            <span className="text-xs font-extrabold uppercase tracking-widest">Team</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-12 sm:mt-20 relative z-10">
        
        <div className="text-center mb-16 sm:mb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tighter text-foreground mb-4">
            Meet the Builders
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
            The minds behind the code, design, and architecture.
          </p>
        </div>

        {/* Call-to-action: Join & Contribute */}
        <div className="max-w-3xl mx-auto mb-12 animate-in fade-in duration-500">
          <Card className="p-6 sm:p-8 rounded-2xl bg-primary/5 border border-primary/10 text-center">
            <h3 className="text-xl sm:text-2xl font-extrabold mb-2">JOIN NOW AND CONTRIBUTE WITH YOUR IDEAS AND INNOVATION</h3>
            <p className="text-sm text-muted-foreground mb-4">We welcome your ideas, issues, and pull requests — help shape the future of ShareHub4U.</p>
            <div className="flex items-center justify-center gap-3">
              <a href="https://github.com/ramswarooppatel/ShareHub4U" target="_blank" rel="noreferrer">
                <Button className="px-6">View on GitHub</Button>
              </a>
              <a href="https://github.com/ramswarooppatel/ShareHub4U/issues" target="_blank" rel="noreferrer">
                <Button variant="ghost" className="px-6">Open an Issue</Button>
              </a>
            </div>
          </Card>
        </div>

        {/* ADMIN (Centered at Top) */}
        {admin && (
          <div className="mb-16 sm:mb-24 animate-in fade-in zoom-in-95 duration-1000 delay-150">
            <div className="relative max-w-2xl mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-[3rem] blur-xl opacity-50" />
              
              <Card className="relative flex flex-col items-center text-center p-8 sm:p-12 border border-white/20 dark:border-white/10 shadow-[0_20px_60px_rgb(0,0,0,0.08)] dark:shadow-[0_20px_60px_rgb(0,0,0,0.3)] bg-white/60 dark:bg-zinc-900/60 backdrop-blur-3xl overflow-hidden rounded-[2.5rem] sm:rounded-[3rem]">
                
                <div className="absolute top-6 right-6 sm:top-8 sm:right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest">Lead</span>
                </div>

                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white/50 dark:border-white/10 shadow-2xl mb-6 sm:mb-8 overflow-hidden bg-background">
                  <img src={admin.avatar} alt={admin.name} className="w-full h-full object-cover" />
                </div>
                
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
                  {admin.name}
                </h2>
                <p className="text-primary font-bold tracking-widest uppercase text-xs sm:text-sm mb-6">
                  {admin.title}
                </p>
                
                <p className="text-base sm:text-lg text-muted-foreground max-w-md mb-8 leading-relaxed">
                  {admin.description}
                </p>

                {/* Admin Socials */}
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                  {admin.socials?.github && (
                    <a href={admin.socials.github} target="_blank" rel="noreferrer" className="p-3 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-foreground transition-all active:scale-95" title="GitHub">
                      <Github className="h-5 w-5 sm:h-6 sm:w-6" />
                    </a>
                  )}
                  {admin.socials?.twitter && (
                    <a href={admin.socials.twitter} target="_blank" rel="noreferrer" className="p-3 rounded-full bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] transition-all active:scale-95" title="Twitter / X">
                      <Twitter className="h-5 w-5 sm:h-6 sm:w-6" />
                    </a>
                  )}
                  {admin.socials?.linkedin && (
                    <a href={admin.socials.linkedin} target="_blank" rel="noreferrer" className="p-3 rounded-full bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] transition-all active:scale-95" title="LinkedIn">
                      <Linkedin className="h-5 w-5 sm:h-6 sm:w-6" />
                    </a>
                  )}
                  {admin.socials?.instagram && (
                    <a href={admin.socials.instagram} target="_blank" rel="noreferrer" className="p-3 rounded-full bg-[#E1306C]/10 hover:bg-[#E1306C]/20 text-[#E1306C] transition-all active:scale-95" title="Instagram">
                      <Instagram className="h-5 w-5 sm:h-6 sm:w-6" />
                    </a>
                  )}
                  {admin.socials?.portfolio && (
                    <a href={admin.socials.portfolio} target="_blank" rel="noreferrer" className="p-3 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all active:scale-95" title="Portfolio / Website">
                      <Globe className="h-5 w-5 sm:h-6 sm:w-6" />
                    </a>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* OTHER CONTRIBUTORS GRID */}
        {contributors.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
            <div className="flex items-center justify-center gap-3 mb-10">
              <div className="h-px w-12 sm:w-24 bg-gradient-to-r from-transparent to-border" />
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/40 border border-white/10 backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Core Contributors</h3>
              </div>
              <div className="h-px w-12 sm:w-24 bg-gradient-to-l from-transparent to-border" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {contributors.map((contributor) => (
                <Card key={contributor.id} className="flex flex-col p-6 sm:p-8 border border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[2rem] hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 rounded-full border-2 border-white/30 dark:border-white/10 shadow-md overflow-hidden bg-background shrink-0">
                      <img src={contributor.avatar} alt={contributor.name} className="w-full h-full object-cover" />
                    </div>
                    
                    {/* Contributor Socials - Compact Version */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {contributor.socials?.github && (
                        <a href={contributor.socials.github} target="_blank" rel="noreferrer" className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors" title="GitHub">
                          <Github className="h-4 w-4" />
                        </a>
                      )}
                      {contributor.socials?.twitter && (
                        <a href={contributor.socials.twitter} target="_blank" rel="noreferrer" className="p-1.5 rounded-full hover:bg-[#1DA1F2]/10 text-muted-foreground hover:text-[#1DA1F2] transition-colors" title="Twitter">
                          <Twitter className="h-4 w-4" />
                        </a>
                      )}
                      {contributor.socials?.linkedin && (
                        <a href={contributor.socials.linkedin} target="_blank" rel="noreferrer" className="p-1.5 rounded-full hover:bg-[#0A66C2]/10 text-muted-foreground hover:text-[#0A66C2] transition-colors" title="LinkedIn">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                      {contributor.socials?.instagram && (
                        <a href={contributor.socials.instagram} target="_blank" rel="noreferrer" className="p-1.5 rounded-full hover:bg-[#E1306C]/10 text-muted-foreground hover:text-[#E1306C] transition-colors" title="Instagram">
                          <Instagram className="h-4 w-4" />
                        </a>
                      )}
                      {contributor.socials?.portfolio && (
                        <a href={contributor.socials.portfolio} target="_blank" rel="noreferrer" className="p-1.5 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Portfolio">
                          <LinkIcon className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-extrabold tracking-tight mb-1">{contributor.name}</h3>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-4">{contributor.title}</p>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed mt-auto">
                    {contributor.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default Contributors;
import React, { useState } from 'react';
import { Check, Star, Gift, Trophy, Clock, Sparkles, ChevronRight, Coins } from 'lucide-react';
import { toast } from 'react-hot-toast';

const DailyChallengesPage = () => {
  const [challenges, setChallenges] = useState([
    { 
      id: 1, 
      title: 'Place your first bid', 
      description: 'Participate in any auction by placing at least one bid', 
      points: 50, 
      completed: false, 
      icon: <Star className="text-action-primary" />,
      animation: 'animate-pulse'
    },
    { 
      id: 2, 
      title: 'Complete your profile', 
      description: 'Fill out all the information in your profile settings', 
      points: 30, 
      completed: true, 
      icon: <Check className="text-status-success" />,
      animation: 'animate-bounce'
    },
    { 
      id: 3, 
      title: 'Win an auction', 
      description: 'Successfully win at least one auction item', 
      points: 100, 
      completed: false, 
      icon: <Trophy className="text-action-primary" />,
      animation: 'animate-spin'
    },
    { 
      id: 4, 
      title: 'Daily login streak', 
      description: 'Log in to Auction X every day for a week', 
      points: 20, 
      completed: false, 
      icon: <Clock className="text-action-primary" />,
      animation: 'animate-ping'
    },
    { 
      id: 5, 
      title: 'Refer a friend', 
      description: 'Invite a fellow collector to join Auction X', 
      points: 75, 
      completed: false, 
      icon: <Gift className="text-action-primary" />,
      animation: 'animate-bounce'
    }
  ]);

  const [points, setPoints] = useState(130);
  const [showCoinBurst, setShowCoinBurst] = useState(false);

  const toggleCompletion = (id) => {
    setChallenges(challenges.map(challenge => {
      if (challenge.id === id) {
        const newCompleted = !challenge.completed;
        
        if (newCompleted && !challenge.completed) {
          setPoints(prev => prev + challenge.points);
          setShowCoinBurst(true);
          toast.success(`Challenge completed! +${challenge.points} points awarded.`);
          setTimeout(() => setShowCoinBurst(false), 2000);
        }
        else if (!newCompleted && challenge.completed) {
          setPoints(prev => prev - challenge.points);
          toast(`Challenge marked incomplete. -${challenge.points} points.`);
        }
        
        return { ...challenge, completed: newCompleted };
      }
      return challenge;
    }));
  };

  const handleRedeem = (reward) => {
    if (points >= reward.cost) {
      setPoints((prev) => prev - reward.cost);
      toast.success(`Successfully redeemed: ${reward.name}! Benefit applied to your account.`);
    } else {
      toast.error(`Not enough points. You need ${reward.cost - points} more points.`);
    }
  };

  const rewards = [
    { name: "Auction Fee Waiver", cost: 200, icon: <Coins className="text-action-primary" /> },
    { name: "Premium Listing Badge", cost: 350, icon: <Sparkles className="text-action-primary" /> },
    { name: "VIP Auction Access", cost: 500, icon: <Trophy className="text-action-primary" /> }
  ];

  return (
    <div className="min-h-screen bg-canvas text-foreground p-4 sm:p-6 lg:p-8 mt-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-surface-dark rounded-2xl p-6 sm:p-8 mb-6 shadow-warm-md text-foreground-inverse relative overflow-hidden">
          <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${showCoinBurst ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
            {showCoinBurst && Array(20).fill().map((_, i) => (
              <div 
                key={i} 
                className="absolute h-3 w-3 bg-action-primary rounded-full"
                style={{
                  animation: `coinBurst 1.5s ease-out forwards`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 relative z-10">
            <div>
              <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/20 px-3 py-1 rounded-full mb-2">
                Member Quests
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display">Daily Challenges</h1>
              <p className="mt-1 text-sm text-muted max-w-xl">
                Complete daily platform activities to earn reward points. Redeem points for fee waivers and VIP privileges.
              </p>
            </div>
            <div className="flex items-center self-start sm:self-auto bg-surface/20 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 shadow-warm-xs">
              <Star className="text-action-primary mr-2 fill-action-primary" />
              <span className="text-lg font-bold font-display text-white">{points} Points</span>
            </div>
          </div>
        </div>
        
        {/* Challenges Section */}
        <div className="bg-surface rounded-2xl shadow-warm-xs border border-border-subtle overflow-hidden mb-6">
          <div className="p-6 border-b border-border-subtle bg-surface-subtle">
            <h2 className="text-lg font-semibold text-foreground font-display">
              Active Challenges
            </h2>
          </div>
          <ul className="divide-y divide-border-subtle">
            {challenges.map(challenge => (
              <li key={challenge.id} className="p-6 hover:bg-surface-subtle/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-surface-subtle border border-border-subtle shrink-0">
                      {challenge.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-foreground">
                        {challenge.title}
                      </h3>
                      <p className="text-muted text-xs sm:text-sm mt-0.5">
                        {challenge.description}
                      </p>
                      <div className="mt-2 flex items-center">
                        <span className="text-action-primary text-xs font-bold flex items-center">
                          <Star className="h-3.5 w-3.5 mr-1 fill-action-primary" />
                          +{challenge.points} points
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCompletion(challenge.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 self-start sm:self-auto ${
                      challenge.completed 
                        ? 'bg-status-success/15 text-status-success border border-status-success/30' 
                        : 'bg-action-primary hover:bg-action-primary-hover text-white shadow-warm-xs'
                    }`}
                  >
                    {challenge.completed ? 'Completed ✓' : 'Mark Complete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Rewards Section */}
        <div className="bg-surface rounded-2xl shadow-warm-xs border border-border-subtle overflow-hidden">
          <div className="p-6 border-b border-border-subtle bg-surface-subtle">
            <h2 className="text-lg font-semibold text-foreground font-display">
              Redeem Platform Benefits
            </h2>
          </div>
          <ul className="divide-y divide-border-subtle">
            {rewards.map((reward, index) => {
              const canRedeem = points >= reward.cost;
              return (
                <li key={index} className="p-6 hover:bg-surface-subtle/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-surface-subtle border border-border-subtle shrink-0">
                        {reward.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-base text-foreground">
                          {reward.name}
                        </h3>
                        <div className="mt-1 flex items-center">
                          <span className="text-action-primary text-xs font-bold flex items-center">
                            <Star className="h-3.5 w-3.5 mr-1 fill-action-primary" />
                            {reward.cost} points required
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRedeem(reward)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 self-start sm:self-auto ${
                        canRedeem 
                          ? 'bg-action-primary hover:bg-action-primary-hover text-white shadow-warm-xs cursor-pointer' 
                          : 'bg-surface-subtle border border-border-subtle text-muted cursor-not-allowed opacity-60'
                      }`}
                      disabled={!canRedeem}
                    >
                      <span>Redeem Benefit</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      
      <style>{`
        @keyframes coinBurst {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(-100px) rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default DailyChallengesPage;
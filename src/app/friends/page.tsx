"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Sparkles,
  Layers,
  ArrowRight,
  X,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface Friend {
  id: string;
  name: string;
  friendCode: string;
  createdAt: string;
}

interface IdleCard {
  id: string;
  cardName: string;
  cardSlug: string;
  element: string;
  class: string;
  setPrefix: string;
  collectorNumber: string;
  foil: boolean;
  population: number;
  isLowPop: boolean;
  idleQuantity: number;
  imageUrl: string;
}

export default function FriendsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  // Add friend state
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // Friend Idle Binder Modal
  const [inspectingFriend, setInspectingFriend] = useState<Friend | null>(null);
  const [idleCards, setIdleCards] = useState<IdleCard[]>([]);
  const [loadingIdle, setLoadingIdle] = useState(false);

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/friends");
      const data = await res.json();
      setCurrentUser(data.currentUser);
      setFriends(data.friends || []);
    } catch (err) {
      console.error("Failed to load friends:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleConnectFriend = async () => {
    if (!friendCodeInput.trim()) return;
    setConnecting(true);
    setConnectMsg("");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendCode: friendCodeInput.trim() }),
      });
      const data = await res.json();
      if (data.success || data.friend) {
        setConnectMsg(`Connected with ${data.friend?.name || "Friend"}!`);
        setFriendCodeInput("");
        fetchFriends();
      } else {
        setConnectMsg(data.error || "Failed to link friend");
      }
    } catch (err: any) {
      setConnectMsg(err.message);
    } finally {
      setConnecting(false);
      setTimeout(() => setConnectMsg(""), 4000);
    }
  };

  const handleInspectIdle = async (friend: Friend) => {
    setInspectingFriend(friend);
    setLoadingIdle(true);
    try {
      const res = await fetch(`/api/friends/${friend.id}/idle`);
      const data = await res.json();
      setIdleCards(data.idleCards || []);
    } catch (err) {
      console.error("Failed to load idle binder:", err);
    } finally {
      setLoadingIdle(false);
    }
  };

  const copyCode = () => {
    if (currentUser?.friendCode) {
      navigator.clipboard.writeText(currentUser.friendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
          <span>Playgroup Friends & Idle Sharing</span>
          <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-xs text-indigo-400">
            {friends.length} Friends
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Connect with your local playgroup to view idle binder cards and borrow missing tournament copies.
        </p>
      </div>

      {/* Code Sharing & Connect Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your Friend Code */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Your Playgroup Friend Link Code
          </span>
          <div className="flex items-center justify-between pt-1">
            <span className="font-mono text-base font-extrabold text-indigo-400">
              {currentUser?.friendCode || "GA-ALEX01"}
            </span>
            <button
              onClick={copyCode}
              className="flex items-center space-x-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied!" : "Copy Code"}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Share this code with teammates so they can connect with you in one click.
          </p>
        </div>

        {/* Connect Friend Bar */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Establish Mutual Friend Link
          </span>
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="text"
              placeholder="Enter friend code (e.g. GA-BOB77)..."
              value={friendCodeInput}
              onChange={(e) => setFriendCodeInput(e.target.value)}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none uppercase font-mono"
            />
            <button
              onClick={handleConnectFriend}
              disabled={connecting || !friendCodeInput.trim()}
              className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Connect</span>
            </button>
          </div>
          {connectMsg && <p className="text-xs text-indigo-400 animate-pulse">{connectMsg}</p>}
        </div>
      </div>

      {/* Friends List Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Loading friend network...</p>
        </div>
      ) : friends.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <p className="text-slate-400 text-sm">No friends linked yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            Connect using the code bar above (e.g. try adding demo friend code <code className="text-indigo-400">GA-BOB77</code>).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {friends.map((friend) => (
            <div
              key={friend.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">
                    {friend.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{friend.name}</h3>
                    <span className="font-mono text-xs text-slate-400">{friend.friendCode}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 text-xs text-emerald-400 mt-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Mutual Friend Link Active</span>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800">
                <button
                  onClick={() => handleInspectIdle(friend)}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-slate-800 hover:bg-indigo-600 py-2.5 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 group-hover:text-white" />
                  <span>Explore {friend.name.split(" ")[0]}'s Idle Binder</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friend Idle Binder Modal */}
      {inspectingFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <button
              onClick={() => setInspectingFriend(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {inspectingFriend.name}'s Idle Trade Binder
                </h2>
                <p className="text-xs text-slate-400">
                  Cards owned by {inspectingFriend.name} that are unassigned and NOT locked in active decks.
                </p>
              </div>
            </div>

            {loadingIdle ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="text-sm text-slate-400">Fetching idle inventory...</p>
              </div>
            ) : idleCards.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No idle unassigned cards currently available in {inspectingFriend.name}'s binder.
              </div>
            ) : (
              <div className="overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950/60">
                {idleCards.map((card) => (
                  <div
                    key={card.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-900/40 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{card.cardName}</div>
                      <div className="text-[11px] text-slate-400">
                        {card.setPrefix} #{card.collectorNumber} • {card.foil ? "Foil" : "Non-Foil"}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-xs font-bold text-emerald-300">
                        {card.idleQuantity} Idle {card.idleQuantity === 1 ? "Copy" : "Copies"} Available
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

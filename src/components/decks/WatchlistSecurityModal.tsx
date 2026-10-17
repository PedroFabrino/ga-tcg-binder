"use client";

import { useState } from "react";
import { ShieldCheck, ExternalLink, Code, CheckCircle, AlertCircle, ChevronDown, ChevronRight, X } from "lucide-react";
import { Modal } from "@/components/common";
import { Button } from "@/components/ui/button";

interface WatchlistSecurityModalProps {
  onClose: () => void;
  userId: string;
  pendingAdds: any[];
  pendingUpdates: any[];
  pendingRemoves: any[];
}

export default function WatchlistSecurityModal({
  onClose,
  userId,
  pendingAdds,
  pendingUpdates,
  pendingRemoves,
}: WatchlistSecurityModalProps) {
  const [showCode, setShowCode] = useState(false);

  const scriptGithubUrl =
    "https://github.com/PedroFabrino/ga-tcg-binder/blob/main/public/scripts/myp-watchlist-sync.user.js";

  const handleLaunchSync = () => {
    const payload = {
      appUrl: window.location.origin,
      userId,
      pendingAdds: pendingAdds.map((item) => ({
        id: item.id,
        cardName: item.cardName,
        editionSlug: item.editionSlug,
        collectorNumber: item.collectorNumber,
        targetQuantity: item.targetQuantity,
        targetPriceBrl: item.targetPriceBrl,
        mypItemId: item.mypItemId,
      })),
      pendingUpdates: pendingUpdates.map((item) => ({
        id: item.id,
        cardName: item.cardName,
        editionSlug: item.editionSlug,
        targetQuantity: item.targetQuantity,
        mypItemId: item.mypItemId,
      })),
      pendingRemoves: pendingRemoves.map((item) => ({
        id: item.id,
        cardName: item.cardName,
        editionSlug: item.editionSlug,
        mypItemId: item.mypItemId,
      })),
    };

    const encoded = encodeURIComponent(JSON.stringify(payload));
    const targetUrl = `https://mypcards.com/grandarchive#ga_watchlist_sync=${encoded}`;

    window.open(targetUrl, "_blank");
    onClose();
  };

  const totalMutations = pendingAdds.length + pendingUpdates.length + pendingRemoves.length;

  return (
    <Modal
      title="Sincronização Segura via Browser Bridge"
      subtitle="Ponte transparente executada no seu navegador sem armazenamento de credenciais"
      onClose={onClose}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between">
          <a
            href={scriptGithubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver código aberto no GitHub
          </a>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" size="sm">
              Cancelar
            </Button>
            <Button
              onClick={handleLaunchSync}
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-500/20"
              disabled={totalMutations === 0}
            >
              Iniciar Sincronização no MyP Cards
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-slate-300 text-sm">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-emerald-300 text-sm">Sua Senha e Sessão Permanecem Privadas</p>
            <p className="text-slate-300 leading-relaxed">
              O script roda diretamente na sua aba do MyP Cards usando a sua sessão ativa. Ele <strong>nunca</strong> lê, intercepta ou envia sua senha ou cookies de autenticação para o servidor.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Resumo de Alterações Pendentes ({totalMutations})
          </h4>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
              <span className="block text-emerald-400 font-bold text-base">+{pendingAdds.length}</span>
              <span className="text-[11px] text-slate-400">A Adicionar</span>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
              <span className="block text-amber-400 font-bold text-base">~{pendingUpdates.length}</span>
              <span className="text-[11px] text-slate-400">Ajuste de Qtd</span>
            </div>
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2">
              <span className="block text-rose-400 font-bold text-base">-{pendingRemoves.length}</span>
              <span className="text-[11px] text-slate-400">Quotas Cheias</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-slate-900/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="w-full flex items-center justify-between p-3 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Code className="h-4 w-4 text-blue-400" />
              Como funciona o script (Auditoria de Código)
            </span>
            {showCode ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showCode && (
            <div className="p-3 border-t border-white/[0.06] bg-slate-950 font-mono text-[11px] text-slate-400 leading-relaxed max-h-48 overflow-y-auto">
              <p className="text-slate-300 mb-2">// 1. Lê a hashtag com a lista de cards necessários</p>
              <p className="text-slate-300 mb-2">// 2. Exibe confirmação visual na página do MyP Cards</p>
              <p className="text-slate-300 mb-2">// 3. Envia requisições espaçadas (350ms) usando seu CSRF token local</p>
              <p className="text-slate-300">// 4. Notifica o binder de que as alterações foram concluídas</p>
              <div className="mt-3 pt-2 border-t border-slate-800">
                <a
                  href={scriptGithubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  Ver arquivo unminified completo em public/scripts/myp-watchlist-sync.user.js
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type StatusPedido =
    | 'NOVO'
    | 'CONFIRMADO'
    | 'EM_PREPARO'
    | 'PRONTO'
    | 'ENTREGUE'
    | 'CANCELADO';

type ItemPedido = {
    id: string;
    produto_id: string | null;
    produto_nome: string;
    preco_unitario: string | number;
    quantidade: number;
    subtotal: string | number;
    observacao: string | null;
};

type Pedido = {
    id: string;
    codigo: string;
    cliente_nome: string | null;
    origem: string;
    status: StatusPedido;
    subtotal: string | number;
    taxa_servico: string | number;
    desconto: string | number;
    total: string | number;
    observacao: string | null;
    created_at: string;
    updated_at: string;
    mesa_id: string | null;
    mesa_numero: string | number | null;
    itens?: ItemPedido[];
};

type Resposta<T> = {
    status: boolean | string;
    message?: string;
    dados?: T;
};

const STATUS: { valor: StatusPedido; titulo: string }[] = [
    { valor: 'NOVO', titulo: 'Novos' },
    { valor: 'CONFIRMADO', titulo: 'Confirmados' },
    { valor: 'EM_PREPARO', titulo: 'Em preparo' },
    { valor: 'PRONTO', titulo: 'Prontos' },
    { valor: 'ENTREGUE', titulo: 'Entregues' },
    { valor: 'CANCELADO', titulo: 'Cancelados' },
];

const PROXIMOS_STATUS: Partial<Record<StatusPedido, StatusPedido[]>> = {
    NOVO: ['CONFIRMADO', 'CANCELADO'],
    CONFIRMADO: ['EM_PREPARO', 'CANCELADO'],
    EM_PREPARO: ['PRONTO', 'CANCELADO'],
    PRONTO: ['ENTREGUE'],
};

function formatarMoeda(valor: string | number) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function formatarData(data: string) {
    const dataValida = new Date(data);

    if (Number.isNaN(dataValida.getTime())) {
        return data;
    }

    return dataValida.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function tituloStatus(status: string) {
    return STATUS.find((item) => item.valor === status)?.titulo || status;
}

function classeStatus(status: StatusPedido) {
    const classes: Record<StatusPedido, string> = {
        NOVO: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
        CONFIRMADO: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-300',
        EM_PREPARO: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
        PRONTO: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
        ENTREGUE: 'border-gray-400/30 bg-gray-400/10 text-gray-300',
        CANCELADO: 'border-red-400/30 bg-red-400/10 text-red-300',
    };

    return classes[status] || classes.NOVO;
}

export default function PedidosPage() {
    const router = useRouter();

    const [pedidos, setPedidos] = useState<Pedido[]>([]);
    const [filtro, setFiltro] = useState('TODOS');
    const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [atualizando, setAtualizando] = useState(false);
    const [erro, setErro] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);

    const sair = useCallback(() => {
        sessionStorage.removeItem('menuvivo_token');
        sessionStorage.removeItem('menuvivo_usuario');
        router.replace('/login');
    }, [router]);

    const requisicao = useCallback(
        async <T,>(caminho: string, opcoes: RequestInit = {}): Promise<T> => {
            const token = sessionStorage.getItem('menuvivo_token');

            if (!token) {
                sair();
                throw new Error('Sua sessão expirou. Entre novamente.');
            }

            if (!API_URL) {
                throw new Error('A URL da API não está configurada.');
            }

            const resposta = await fetch(`${API_URL}${caminho}`, {
                ...opcoes,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    ...opcoes.headers,
                },
                cache: 'no-store',
            });

            const dados = await resposta.json().catch(() => null);

            if (resposta.status === 401 || resposta.status === 403) {
                sair();
                throw new Error(
                    dados?.message || 'Sessão inválida ou acesso não autorizado.'
                );
            }

            if (!resposta.ok) {
                throw new Error(
                    dados?.message || 'Não foi possível concluir a operação.'
                );
            }

            return dados as T;
        },
        [sair]
    );

    const carregarPedidos = useCallback(
        async (silencioso = false) => {
            if (silencioso) {
                setAtualizando(true);
            } else {
                setCarregando(true);
            }

            setErro('');

            try {
                const resposta = await requisicao<Resposta<Pedido[]>>('/pedidos');

                if (!Array.isArray(resposta.dados)) {
                    throw new Error('A API retornou uma lista de pedidos inválida.');
                }

                setPedidos(resposta.dados);

                setPedidoSelecionado((atual) => {
                    if (!atual) return atual;

                    const atualizado = resposta.dados?.find(
                        (pedido) => pedido.id === atual.id
                    );

                    return atualizado
                        ? { ...atualizado, itens: atual.itens }
                        : null;
                });
            } catch (error) {
                setErro(
                    error instanceof Error
                        ? error.message
                        : 'Erro ao carregar pedidos.'
                );
            } finally {
                setCarregando(false);
                setAtualizando(false);
            }
        },
        [requisicao]
    );

    useEffect(() => {
        if (!API_URL) {
            setErro('Configure NEXT_PUBLIC_API_URL no arquivo .env.local.');
            setCarregando(false);
            return;
        }

        if (!sessionStorage.getItem('menuvivo_token')) {
            router.replace('/login');
            return;
        }

        void carregarPedidos();
    }, [carregarPedidos, router]);

    async function abrirDetalhes(pedido: Pedido) {
        setErro('');
        setMensagem('');

        try {
            const resposta = await requisicao<Resposta<Pedido>>(
                `/pedidos/${encodeURIComponent(pedido.id)}`
            );

            if (!resposta.dados) {
                throw new Error('A API não retornou os detalhes do pedido.');
            }

            setPedidoSelecionado(resposta.dados);
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível abrir o pedido.'
            );
        }
    }

    async function alterarStatus(pedido: Pedido, novoStatus: StatusPedido) {
        const confirmacao =
            novoStatus === 'CANCELADO'
                ? window.confirm(`Deseja realmente cancelar o pedido ${pedido.codigo}?`)
                : true;

        if (!confirmacao) return;

        setAcaoEmAndamento(true);
        setErro('');
        setMensagem('');

        try {
            const resposta = await requisicao<Resposta<Pedido>>(
                `/pedidos/${encodeURIComponent(pedido.id)}/status`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ status: novoStatus }),
                }
            );

            setMensagem(
                resposta.message || 'Status atualizado com sucesso.'
            );

            await carregarPedidos(true);

            if (pedidoSelecionado?.id === pedido.id) {
                await abrirDetalhes({ ...pedido, status: novoStatus });
            }
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível atualizar o pedido.'
            );
        } finally {
            setAcaoEmAndamento(false);
        }
    }

    const pedidosFiltrados =
        filtro === 'TODOS'
            ? pedidos
            : pedidos.filter((pedido) => pedido.status === filtro);

    const contagemNovos = pedidos.filter(
        (pedido) => pedido.status === 'NOVO'
    ).length;

    if (carregando) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#101310] text-gray-300">
                Carregando pedidos...
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#101310] text-white">
            <header className="border-b border-white/10 bg-[#1A1E1A]">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div>
                        <a href="/dashboard" className="text-xl font-bold">
                            Menu<span className="text-[#65D69A]">Vivo</span>
                        </a>

                        <p className="text-xs text-gray-400">
                            Central de pedidos
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                        >
                            Voltar ao painel
                        </button>

                        <button
                            onClick={sair}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                        >
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            <section className="mx-auto max-w-7xl px-5 py-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-[#65D69A]">
                            ATENDIMENTO
                        </p>

                        <h1 className="mt-2 text-3xl font-bold">
                            Pedidos
                        </h1>

                        <p className="mt-2 text-sm text-gray-400">
                            Acompanhe os pedidos e atualize o andamento do atendimento.
                        </p>
                    </div>

                    <button
                        onClick={() => void carregarPedidos(true)}
                        disabled={atualizando}
                        className="rounded-xl bg-[#65D69A] px-4 py-3 font-semibold text-[#101310] transition hover:bg-[#7BE5AC] disabled:opacity-50"
                    >
                        {atualizando ? 'Atualizando...' : 'Atualizar pedidos'}
                    </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-[#1A1E1A] p-5">
                        <p className="text-sm text-gray-400">Total na lista</p>
                        <p className="mt-2 text-3xl font-bold">{pedidos.length}</p>
                    </div>

                    <div className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-5">
                        <p className="text-sm text-gray-400">Aguardando confirmação</p>
                        <p className="mt-2 text-3xl font-bold text-blue-300">
                            {contagemNovos}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#1A1E1A] p-5">
                        <p className="text-sm text-gray-400">Em andamento</p>
                        <p className="mt-2 text-3xl font-bold text-[#65D69A]">
                            {
                                pedidos.filter((pedido) =>
                                    ['CONFIRMADO', 'EM_PREPARO', 'PRONTO'].includes(
                                        pedido.status
                                    )
                                ).length
                            }
                        </p>
                    </div>
                </div>

                {erro && (
                    <div
                        role="alert"
                        className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                    >
                        {erro}
                    </div>
                )}

                {mensagem && (
                    <div
                        role="status"
                        className="mt-5 rounded-xl border border-[#65D69A]/30 bg-[#65D69A]/10 px-4 py-3 text-sm text-[#8BE8B4]"
                    >
                        {mensagem}
                    </div>
                )}

                <div className="mt-8 flex flex-wrap gap-2">
                    <button
                        onClick={() => setFiltro('TODOS')}
                        className={`rounded-full border px-4 py-2 text-sm ${
                            filtro === 'TODOS'
                                ? 'border-[#65D69A] bg-[#65D69A] font-semibold text-[#101310]'
                                : 'border-white/10 text-gray-300 hover:bg-white/5'
                        }`}
                    >
                        Todos ({pedidos.length})
                    </button>

                    {STATUS.map((item) => {
                        const quantidade = pedidos.filter(
                            (pedido) => pedido.status === item.valor
                        ).length;

                        return (
                            <button
                                key={item.valor}
                                onClick={() => setFiltro(item.valor)}
                                className={`rounded-full border px-4 py-2 text-sm ${
                                    filtro === item.valor
                                        ? 'border-[#65D69A] bg-[#65D69A] font-semibold text-[#101310]'
                                        : 'border-white/10 text-gray-300 hover:bg-white/5'
                                }`}
                            >
                                {item.titulo} ({quantidade})
                            </button>
                        );
                    })}
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#1A1E1A]">
                    {pedidosFiltrados.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <div className="text-4xl">▤</div>
                            <h2 className="mt-4 text-lg font-semibold">
                                Nenhum pedido encontrado
                            </h2>
                            <p className="mt-2 text-sm text-gray-400">
                                Os pedidos recebidos aparecerão aqui.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {pedidosFiltrados.map((pedido) => (
                                <article
                                    key={pedido.id}
                                    className="p-5 transition hover:bg-white/[0.02]"
                                >
                                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h2 className="text-lg font-bold">
                                                    #{pedido.codigo}
                                                </h2>

                                                <span
                                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${classeStatus(pedido.status)}`}
                                                >
                                                    {tituloStatus(pedido.status)}
                                                </span>
                                            </div>

                                            <p className="mt-2 text-sm text-gray-300">
                                                {pedido.cliente_nome || 'Cliente não identificado'}
                                                {' · '}
                                                {pedido.mesa_numero != null
                                                    ? `Mesa ${pedido.mesa_numero}`
                                                    : 'Sem mesa vinculada'}
                                            </p>

                                            <p className="mt-1 text-xs text-gray-500">
                                                {formatarData(pedido.created_at)}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="mr-2">
                                                <p className="text-xs text-gray-400">
                                                    Total
                                                </p>
                                                <p className="text-lg font-bold text-[#65D69A]">
                                                    {formatarMoeda(pedido.total)}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => void abrirDetalhes(pedido)}
                                                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                                            >
                                                Ver detalhes
                                            </button>

                                            {PROXIMOS_STATUS[pedido.status]?.map(
                                                (proximoStatus) => (
                                                    <button
                                                        key={proximoStatus}
                                                        disabled={acaoEmAndamento}
                                                        onClick={() =>
                                                            void alterarStatus(
                                                                pedido,
                                                                proximoStatus
                                                            )
                                                        }
                                                        className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                                                            proximoStatus === 'CANCELADO'
                                                                ? 'border border-red-500/30 text-red-300 hover:bg-red-500/10'
                                                                : 'bg-[#65D69A] text-[#101310] hover:bg-[#7BE5AC]'
                                                        }`}
                                                    >
                                                        {proximoStatus === 'CONFIRMADO'
                                                            ? 'Confirmar'
                                                            : proximoStatus === 'EM_PREPARO'
                                                              ? 'Iniciar preparo'
                                                              : proximoStatus === 'PRONTO'
                                                                ? 'Marcar pronto'
                                                                : proximoStatus === 'ENTREGUE'
                                                                  ? 'Entregar'
                                                                  : 'Cancelar'}
                                                    </button>
                                                )
                                            )}

                                            {pedido.status === 'PRONTO' && (
                                                <button
                                                    disabled={acaoEmAndamento}
                                                    onClick={() =>
                                                        void alterarStatus(
                                                            pedido,
                                                            'ENTREGUE'
                                                        )
                                                    }
                                                    className="rounded-lg bg-[#65D69A] px-4 py-2 text-sm font-semibold text-[#101310] hover:bg-[#7BE5AC] disabled:opacity-50"
                                                >
                                                    Entregar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {pedidoSelecionado && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-5"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setPedidoSelecionado(null);
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titulo-detalhes-pedido"
                        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#1A1E1A] p-5 sm:rounded-2xl sm:p-7"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm text-[#65D69A]">
                                    DETALHES DO PEDIDO
                                </p>

                                <h2
                                    id="titulo-detalhes-pedido"
                                    className="mt-2 text-2xl font-bold"
                                >
                                    #{pedidoSelecionado.codigo}
                                </h2>

                                <p className="mt-2 text-sm text-gray-400">
                                    {formatarData(pedidoSelecionado.created_at)}
                                </p>
                            </div>

                            <button
                                onClick={() => setPedidoSelecionado(null)}
                                aria-label="Fechar detalhes"
                                className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-xl bg-[#101310] p-4">
                                <p className="text-xs text-gray-400">Cliente</p>
                                <p className="mt-1 font-medium">
                                    {pedidoSelecionado.cliente_nome || 'Não identificado'}
                                </p>
                            </div>

                            <div className="rounded-xl bg-[#101310] p-4">
                                <p className="text-xs text-gray-400">Mesa</p>
                                <p className="mt-1 font-medium">
                                    {pedidoSelecionado.mesa_numero != null
                                        ? pedidoSelecionado.mesa_numero
                                        : 'Não vinculada'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6">
                            <h3 className="font-semibold">Itens do pedido</h3>

                            <div className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
                                {!pedidoSelecionado.itens?.length ? (
                                    <p className="p-4 text-sm text-gray-400">
                                        Nenhum item retornado pela API.
                                    </p>
                                ) : (
                                    pedidoSelecionado.itens.map((item) => (
                                        <div key={item.id} className="p-4">
                                            <div className="flex justify-between gap-4">
                                                <div>
                                                    <p className="font-medium">
                                                        {item.quantidade} × {item.produto_nome}
                                                    </p>

                                                    {item.observacao && (
                                                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-400">
                                                            Obs.: {item.observacao}
                                                        </p>
                                                    )}
                                                </div>

                                                <p className="shrink-0 font-semibold">
                                                    {formatarMoeda(item.subtotal)}
                                                </p>
                                            </div>

                                            <p className="mt-1 text-xs text-gray-500">
                                                Unitário: {formatarMoeda(item.preco_unitario)}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {pedidoSelecionado.observacao && (
                            <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                                <h3 className="text-sm font-semibold text-amber-300">
                                    Observação do pedido
                                </h3>

                                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                                    {pedidoSelecionado.observacao}
                                </p>
                            </div>
                        )}

                        <div className="mt-6 space-y-3 rounded-xl bg-[#101310] p-4">
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>Subtotal</span>
                                <span>{formatarMoeda(pedidoSelecionado.subtotal)}</span>
                            </div>

                            <div className="flex justify-between text-sm text-gray-400">
                                <span>Taxa de serviço</span>
                                <span>{formatarMoeda(pedidoSelecionado.taxa_servico)}</span>
                            </div>

                            <div className="flex justify-between text-sm text-gray-400">
                                <span>Desconto</span>
                                <span>- {formatarMoeda(pedidoSelecionado.desconto)}</span>
                            </div>

                            <div className="flex justify-between border-t border-white/10 pt-3 text-lg font-bold">
                                <span>Total</span>
                                <span className="text-[#65D69A]">
                                    {formatarMoeda(pedidoSelecionado.total)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            {PROXIMOS_STATUS[pedidoSelecionado.status]?.map(
                                (proximoStatus) => (
                                    <button
                                        key={proximoStatus}
                                        disabled={acaoEmAndamento}
                                        onClick={() =>
                                            void alterarStatus(
                                                pedidoSelecionado,
                                                proximoStatus
                                            )
                                        }
                                        className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                                            proximoStatus === 'CANCELADO'
                                                ? 'border border-red-500/30 text-red-300 hover:bg-red-500/10'
                                                : 'bg-[#65D69A] text-[#101310] hover:bg-[#7BE5AC]'
                                        }`}
                                    >
                                        {proximoStatus === 'CONFIRMADO'
                                            ? 'Confirmar pedido'
                                            : proximoStatus === 'EM_PREPARO'
                                              ? 'Iniciar preparo'
                                              : proximoStatus === 'PRONTO'
                                                ? 'Marcar pronto'
                                                : proximoStatus === 'ENTREGUE'
                                                  ? 'Entregar'
                                                  : 'Cancelar pedido'}
                                    </button>
                                )
                            )}
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}

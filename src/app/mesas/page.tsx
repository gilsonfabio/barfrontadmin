'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

type StatusMesa = 'ATIVA' | 'INATIVA';

type Mesa = {
    id: string;
    estabelecimento_id: string;
    numero: string;
    codigo_qr: string;
    status: StatusMesa;
    created_at?: string;
    updated_at?: string;
};

type RespostaApi<T> = {
    status: boolean;
    message?: string;
    dados?: T;
};

export default function MesasPage() {
    const router = useRouter();

    const [mesas, setMesas] = useState<Mesa[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');

    const [filtro, setFiltro] = useState('TODAS');
    const [numero, setNumero] = useState('');
    const [editando, setEditando] = useState<Mesa | null>(null);

    const [quantidade, setQuantidade] = useState('10');
    const [inicio, setInicio] = useState('1');

    const [qrSelecionado, setQrSelecionado] = useState<Mesa | null>(null);
    const [imagemQr, setImagemQr] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    const requisicao = useCallback(
        async (caminho: string, opcoes: RequestInit = {}) => {
            const token = sessionStorage.getItem('menuvivo_token');

            if (!token) {
                router.replace('/login');
                throw new Error('Sua sessão expirou. Entre novamente.');
            }

            if (!apiUrl) {
                throw new Error(
                    'A variável NEXT_PUBLIC_API_URL não está configurada.'
                );
            }

            const resposta = await fetch(`${apiUrl}${caminho}`, {
                ...opcoes,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...opcoes.headers,
                },
            });

            const dados = await resposta.json().catch(() => null);

            if (resposta.status === 401) {
                sessionStorage.removeItem('menuvivo_token');
                sessionStorage.removeItem('menuvivo_usuario');
                router.replace('/login');

                throw new Error('Sessão expirada. Faça login novamente.');
            }

            if (!resposta.ok || !dados?.status) {
                throw new Error(
                    dados?.message || 'Não foi possível concluir a operação.'
                );
            }

            return dados;
        },
        [apiUrl, router]
    );

    const carregarMesas = useCallback(async () => {
        setCarregando(true);
        setErro('');

        try {
            const query = filtro === 'TODAS'
                ? ''
                : `?status=${encodeURIComponent(filtro)}`;

            const resposta = await requisicao(`/mesas${query}`);

            setMesas(resposta.dados || []);
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Erro ao carregar mesas.'
            );
        } finally {
            setCarregando(false);
        }
    }, [filtro, requisicao]);

    useEffect(() => {
        const token = sessionStorage.getItem('menuvivo_token');
        const usuario = sessionStorage.getItem('menuvivo_usuario');

        if (!token || !usuario) {
            router.replace('/login');
            return;
        }

        void carregarMesas();
    }, [carregarMesas, router]);

    async function salvarMesa(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        if (!numero.trim()) {
            setErro('Informe a identificação da mesa.');
            return;
        }

        setSalvando(true);
        setErro('');
        setSucesso('');

        try {
            if (editando) {
                await requisicao(`/mesas/${editando.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ numero: numero.trim() }),
                });

                setSucesso('Mesa atualizada com sucesso.');
            } else {
                await requisicao('/mesas', {
                    method: 'POST',
                    body: JSON.stringify({ numero: numero.trim() }),
                });

                setSucesso('Mesa cadastrada com sucesso.');
            }

            setNumero('');
            setEditando(null);

            await carregarMesas();
        } catch (error) {
            setErro(
                error instanceof Error ? error.message : 'Erro ao salvar mesa.'
            );
        } finally {
            setSalvando(false);
        }
    }

    async function gerarLote(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        const qtd = Number(quantidade);
        const numeroInicial = Number(inicio);

        if (!Number.isInteger(qtd) || qtd < 1 || qtd > 100) {
            setErro('A quantidade deve estar entre 1 e 100.');
            return;
        }

        if (
            !Number.isInteger(numeroInicial) ||
            numeroInicial < 1 ||
            numeroInicial + qtd - 1 > 999999
        ) {
            setErro('Informe um número inicial válido.');
            return;
        }

        setSalvando(true);
        setErro('');
        setSucesso('');

        try {
            const resposta = await requisicao('/mesas/gerar-lote', {
                method: 'POST',
                body: JSON.stringify({
                    quantidade: qtd,
                    inicio: numeroInicial,
                }),
            });

            setSucesso(resposta.message || 'Mesas geradas com sucesso.');

            await carregarMesas();
        } catch (error) {
            setErro(
                error instanceof Error ? error.message : 'Erro ao gerar mesas.'
            );
        } finally {
            setSalvando(false);
        }
    }

    async function alterarStatus(mesa: Mesa) {
        const novoStatus = mesa.status === 'ATIVA' ? 'INATIVA' : 'ATIVA';

        setErro('');
        setSucesso('');

        try {
            await requisicao(`/mesas/${mesa.id}/ativar`, {
                method: 'PATCH',
                body: JSON.stringify({ status: novoStatus }),
            });

            setSucesso(
                novoStatus === 'ATIVA'
                    ? 'Mesa ativada com sucesso.'
                    : 'Mesa desativada com sucesso.'
            );

            await carregarMesas();
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Erro ao alterar status.'
            );
        }
    }

    async function visualizarQr(mesa: Mesa) {
        setErro('');
        setQrSelecionado(mesa);
        setImagemQr('');

        try {
            // O código ainda não é a URL pública do cardápio.
            // Aqui geramos um QR provisório com o código da mesa.
            const imagem = await QRCode.toDataURL(mesa.codigo_qr, {
                width: 320,
                margin: 2,
                errorCorrectionLevel: 'H',
            });

            setImagemQr(imagem);
        } catch {
            setErro('Não foi possível gerar a imagem do QR Code.');
        }
    }

    function imprimirQr() {
        if (!qrSelecionado || !imagemQr) return;

        const janela = window.open('', '_blank', 'width=500,height=600');

        if (!janela) {
            setErro('Permita a abertura de janelas para imprimir o QR Code.');
            return;
        }

        janela.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>QR Code - Mesa ${qrSelecionado.numero}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 24px;
                    }
                    img {
                        width: 280px;
                        height: 280px;
                    }
                </style>
            </head>
            <body>
                <h1>MenuVivo</h1>
                <h2>Mesa ${qrSelecionado.numero}</h2>
                <img src="${imagemQr}" alt="QR Code da mesa">
                <p>Escaneie para acessar o cardápio.</p>
                <script>
                    window.onload = () => {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);

        janela.document.close();
    }

    function sair() {
        sessionStorage.removeItem('menuvivo_token');
        sessionStorage.removeItem('menuvivo_usuario');
        router.replace('/login');
    }

    return (
        <main className="min-h-screen bg-[#101310] text-white">
            <header className="border-b border-white/10 bg-[#1A1E1A]">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
                    <div>
                        <h1 className="text-xl font-bold">
                            Menu<span className="text-[#65D69A]">Vivo</span>
                        </h1>
                        <p className="text-xs text-gray-400">
                            Gerenciamento de mesas
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                        >
                            Voltar
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

            <section className="mx-auto max-w-7xl space-y-8 px-5 py-8">
                <div>
                    <p className="text-sm text-[#65D69A]">ADMINISTRAÇÃO</p>
                    <h2 className="mt-2 text-3xl font-bold">
                        Mesas e QR Codes
                    </h2>
                    <p className="mt-2 text-gray-400">
                        Cadastre mesas e gerencie seus códigos de acesso.
                    </p>
                </div>

                {erro && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                        {erro}
                    </div>
                )}

                {sucesso && (
                    <div className="rounded-xl border border-[#65D69A]/30 bg-[#65D69A]/10 p-4 text-sm text-[#65D69A]">
                        {sucesso}
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    <form
                        onSubmit={salvarMesa}
                        className="space-y-4 rounded-2xl border border-white/10 bg-[#1A1E1A] p-6"
                    >
                        <h3 className="text-lg font-semibold">
                            {editando ? 'Editar mesa' : 'Cadastrar mesa'}
                        </h3>

                        <label className="block text-sm text-gray-300">
                            Identificação da mesa
                            <input
                                value={numero}
                                onChange={(evento) => setNumero(evento.target.value)}
                                maxLength={30}
                                required
                                placeholder="Ex.: 01, Varanda 1, Balcão"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#101310] px-4 py-3 outline-none focus:border-[#65D69A]"
                            />
                        </label>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="submit"
                                disabled={salvando}
                                className="rounded-xl bg-[#65D69A] px-5 py-3 font-semibold text-[#101310] disabled:opacity-50"
                            >
                                {salvando
                                    ? 'Salvando...'
                                    : editando
                                        ? 'Salvar alterações'
                                        : 'Cadastrar mesa'}
                            </button>

                            {editando && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditando(null);
                                        setNumero('');
                                    }}
                                    className="rounded-xl border border-white/10 px-5 py-3"
                                >
                                    Cancelar edição
                                </button>
                            )}
                        </div>
                    </form>

                    <form
                        onSubmit={gerarLote}
                        className="space-y-4 rounded-2xl border border-white/10 bg-[#1A1E1A] p-6"
                    >
                        <h3 className="text-lg font-semibold">
                            Gerar mesas em lote
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm text-gray-300">
                                Número inicial
                                <input
                                    type="number"
                                    min="1"
                                    max="999999"
                                    value={inicio}
                                    onChange={(evento) => setInicio(evento.target.value)}
                                    required
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#101310] px-4 py-3 outline-none focus:border-[#65D69A]"
                                />
                            </label>

                            <label className="block text-sm text-gray-300">
                                Quantidade (máx. 100)
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={quantidade}
                                    onChange={(evento) => setQuantidade(evento.target.value)}
                                    required
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#101310] px-4 py-3 outline-none focus:border-[#65D69A]"
                                />
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={salvando}
                            className="rounded-xl bg-[#65D69A] px-5 py-3 font-semibold text-[#101310] disabled:opacity-50"
                        >
                            {salvando ? 'Gerando...' : 'Gerar mesas'}
                        </button>
                    </form>
                </div>

                <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#1A1E1A]">
                    <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center">
                        <div>
                            <h3 className="text-lg font-semibold">
                                Mesas cadastradas
                            </h3>
                            <p className="mt-1 text-sm text-gray-400">
                                {mesas.length} mesa(s) nesta listagem
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <select
                                value={filtro}
                                onChange={(evento) => setFiltro(evento.target.value)}
                                className="rounded-lg border border-white/10 bg-[#101310] px-3 py-2 text-sm"
                            >
                                <option value="TODAS">Todas</option>
                                <option value="ATIVA">Ativas</option>
                                <option value="INATIVA">Inativas</option>
                            </select>

                            <button
                                onClick={() => void carregarMesas()}
                                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                            >
                                Atualizar
                            </button>
                        </div>
                    </div>

                    {carregando ? (
                        <div className="p-10 text-center text-gray-400">
                            Carregando mesas...
                        </div>
                    ) : mesas.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">
                            Nenhuma mesa encontrada.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-gray-400">
                                    <tr>
                                        <th className="px-5 py-4">Mesa</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4">QR Code</th>
                                        <th className="px-5 py-4">Ações</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-white/5">
                                    {mesas.map((mesa) => (
                                        <tr key={mesa.id}>
                                            <td className="px-5 py-4 font-medium">
                                                {mesa.numero}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={
                                                        mesa.status === 'ATIVA'
                                                            ? 'rounded-full bg-[#65D69A]/10 px-3 py-1 text-xs text-[#65D69A]'
                                                            : 'rounded-full bg-gray-500/10 px-3 py-1 text-xs text-gray-400'
                                                    }
                                                >
                                                    {mesa.status}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <button
                                                    onClick={() => void visualizarQr(mesa)}
                                                    className="text-[#65D69A] hover:underline"
                                                >
                                                    Visualizar QR
                                                </button>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex flex-wrap gap-3">
                                                    <button
                                                        onClick={() => {
                                                            setEditando(mesa);
                                                            setNumero(mesa.numero);
                                                            setErro('');
                                                            setSucesso('');
                                                        }}
                                                        className="text-blue-300 hover:underline"
                                                    >
                                                        Editar
                                                    </button>

                                                    <button
                                                        onClick={() => void alterarStatus(mesa)}
                                                        className={
                                                            mesa.status === 'ATIVA'
                                                                ? 'text-red-300 hover:underline'
                                                                : 'text-[#65D69A] hover:underline'
                                                        }
                                                    >
                                                        {mesa.status === 'ATIVA'
                                                            ? 'Desativar'
                                                            : 'Ativar'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {qrSelecionado && (
                    <section className="rounded-2xl border border-white/10 bg-[#1A1E1A] p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    QR Code — Mesa {qrSelecionado.numero}
                                </h3>
                                <p className="mt-1 text-sm text-amber-300">
                                    Código provisório: ainda não abre o cardápio.
                                </p>
                            </div>

                            <button
                                onClick={() => {
                                    setQrSelecionado(null);
                                    setImagemQr('');
                                }}
                                className="rounded-lg border border-white/10 px-4 py-2 text-sm"
                            >
                                Fechar
                            </button>
                        </div>

                        <div className="mt-5 flex flex-col items-center gap-4">
                            {imagemQr ? (
                                <img
                                    src={imagemQr}
                                    alt={`QR Code da mesa ${qrSelecionado.numero}`}
                                    className="h-64 w-64 rounded-xl bg-white p-2"
                                />
                            ) : (
                                <p className="text-gray-400">
                                    Gerando QR Code...
                                </p>
                            )}

                            <button
                                onClick={imprimirQr}
                                disabled={!imagemQr}
                                className="rounded-xl bg-[#65D69A] px-5 py-3 font-semibold text-[#101310] disabled:opacity-50"
                            >
                                Imprimir QR Code
                            </button>
                        </div>
                    </section>
                )}
            </section>
        </main>
    );
}


'use client';

import {
    useCallback,
    useEffect,
    useState,
    type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';

type Categoria = {
    id: string;
    nome: string;
    ativo: number | boolean;
};

type Subcategoria = {
    id: string;
    categoria_id: string;
    categoria_nome?: string;
    nome: string;
    descricao: string | null;
    ordem: number;
    ativo: number | boolean;
    created_at?: string;
    updated_at?: string;
};

type RespostaApi<T> = {
    status: boolean;
    message?: string;
    dados?: T;
};

type FiltroStatus = 'TODAS' | 'ATIVA' | 'INATIVA';

const API_URL = (
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
).replace(/\/+$/, '');

function estaAtivo(valor: number | boolean): boolean {
    return valor === true || valor === 1;
}

export default function SubcategoriasPage() {
    const router = useRouter();

    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);

    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);

    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');

    const [filtro, setFiltro] = useState<FiltroStatus>('TODAS');
    const [filtroCategoria, setFiltroCategoria] = useState('');

    const [editandoId, setEditandoId] = useState<string | null>(null);

    const [categoriaId, setCategoriaId] = useState('');
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [ordem, setOrdem] = useState('0');

    const requisicao = useCallback(
        async <T,>(
            caminho: string,
            opcoes: RequestInit = {},
        ): Promise<RespostaApi<T>> => {
            const token = sessionStorage.getItem('menuvivo_token');

            if (!token) {
                router.push('/login');
                throw new Error('Sua sessão expirou. Entre novamente.');
            }

            const resposta = await fetch(`${API_URL}${caminho}`, {
                ...opcoes,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    ...opcoes.headers,
                },
            });

            if (resposta.status === 401) {
                sessionStorage.removeItem('menuvivo_token');
                sessionStorage.removeItem('menuvivo_usuario');
                router.push('/login');
                throw new Error('Sua sessão expirou. Entre novamente.');
            }

            const dados = await resposta.json().catch(() => ({
                status: false,
                message: 'Não foi possível interpretar a resposta do servidor.',
            }));

            if (!resposta.ok || dados.status === false) {
                throw new Error(
                    dados.message || 'Não foi possível concluir a operação.',
                );
            }

            return dados as RespostaApi<T>;
        },
        [router],
    );

    const carregarDados = useCallback(async () => {
        setCarregando(true);
        setErro('');

        try {
            const [respostaCategorias, respostaSubcategorias] =
                await Promise.all([
                    requisicao<Categoria[]>('/categorias'),
                    requisicao<Subcategoria[]>('/subcategorias'),
                ]);

            setCategorias(respostaCategorias.dados || []);
            setSubcategorias(respostaSubcategorias.dados || []);
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Erro ao carregar subcategorias.',
            );
        } finally {
            setCarregando(false);
        }
    }, [requisicao]);

    useEffect(() => {
        void carregarDados();
    }, [carregarDados]);

    function limparFormulario() {
        setEditandoId(null);
        setCategoriaId('');
        setNome('');
        setDescricao('');
        setOrdem('0');
    }

    function iniciarEdicao(subcategoria: Subcategoria) {
        setEditandoId(subcategoria.id);
        setCategoriaId(subcategoria.categoria_id);
        setNome(subcategoria.nome);
        setDescricao(subcategoria.descricao || '');
        setOrdem(String(subcategoria.ordem ?? 0));

        setErro('');
        setSucesso('');

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    }

    async function salvar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        setErro('');
        setSucesso('');

        if (!categoriaId) {
            setErro('Selecione uma categoria.');
            return;
        }

        if (!nome.trim()) {
            setErro('Informe o nome da subcategoria.');
            return;
        }

        const ordemNumero = Number(ordem);

        if (
            !Number.isInteger(ordemNumero) ||
            ordemNumero < 0
        ) {
            setErro('A ordem deve ser um número inteiro não negativo.');
            return;
        }

        setSalvando(true);

        try {
            const corpo = {
                categoria_id: categoriaId,
                nome: nome.trim(),
                descricao: descricao.trim() || null,
                ordem: ordemNumero,
            };

            if (editandoId) {
                await requisicao<Subcategoria>(
                    `/subcategorias/${editandoId}`,
                    {
                        method: 'PUT',
                        body: JSON.stringify(corpo),
                    },
                );

                setSucesso('Subcategoria atualizada com sucesso.');
            } else {
                await requisicao<Subcategoria>(
                    '/subcategorias',
                    {
                        method: 'POST',
                        body: JSON.stringify(corpo),
                    },
                );

                setSucesso('Subcategoria cadastrada com sucesso.');
            }

            limparFormulario();
            await carregarDados();
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Erro ao salvar subcategoria.',
            );
        } finally {
            setSalvando(false);
        }
    }

    async function alterarStatus(subcategoria: Subcategoria) {
        const ativoAtual = estaAtivo(subcategoria.ativo);
        const novoStatus = !ativoAtual;

        const confirmacao = window.confirm(
            novoStatus
                ? `Deseja ativar a subcategoria "${subcategoria.nome}"?`
                : `Deseja desativar a subcategoria "${subcategoria.nome}"?`,
        );

        if (!confirmacao) {
            return;
        }

        setErro('');
        setSucesso('');

        try {
            await requisicao<unknown>(
                `/subcategorias/${subcategoria.id}/ativar`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        ativo: novoStatus,
                    }),
                },
            );

            setSucesso(
                novoStatus
                    ? 'Subcategoria ativada com sucesso.'
                    : 'Subcategoria desativada com sucesso.',
            );

            await carregarDados();
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : 'Erro ao alterar status.',
            );
        }
    }

    const subcategoriasFiltradas = subcategorias.filter(
        (subcategoria) => {
            const ativa = estaAtivo(subcategoria.ativo);

            if (filtro === 'ATIVA' && !ativa) {
                return false;
            }

            if (filtro === 'INATIVA' && ativa) {
                return false;
            }

            if (
                filtroCategoria &&
                subcategoria.categoria_id !== filtroCategoria
            ) {
                return false;
            }

            return true;
        },
    );

    const totalAtivas = subcategorias.filter(
        (item) => estaAtivo(item.ativo),
    ).length;

    const totalInativas = subcategorias.length - totalAtivas;

    return (
        <main className="min-h-screen bg-[#101310] p-4 text-white sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">

                <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <p className="mb-2 text-sm text-[#65D69A]">
                            MENU VIVO / CARDÁPIO
                        </p>

                        <h1 className="text-2xl font-bold sm:text-3xl">
                            Subcategorias
                        </h1>

                        <p className="mt-2 text-sm text-gray-400">
                            Organize os produtos dentro de cada categoria.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push('/dashboard')}
                        className="rounded-lg border border-[#343B35] px-4 py-2.5 text-sm transition hover:bg-[#1A1E1A]"
                    >
                        Voltar ao painel
                    </button>
                </header>

                {erro && (
                    <div
                        role="alert"
                        className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
                    >
                        {erro}
                    </div>
                )}

                {sucesso && (
                    <div
                        role="status"
                        className="rounded-lg border border-[#65D69A]/30 bg-[#65D69A]/10 p-4 text-sm text-[#65D69A]"
                    >
                        {sucesso}
                    </div>
                )}

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-[#292F2A] bg-[#1A1E1A] p-5">
                        <p className="text-sm text-gray-400">
                            Total de subcategorias
                        </p>
                        <p className="mt-2 text-3xl font-bold">
                            {subcategorias.length}
                        </p>
                    </div>

                    <div className="rounded-xl border border-[#292F2A] bg-[#1A1E1A] p-5">
                        <p className="text-sm text-gray-400">
                            Subcategorias ativas
                        </p>
                        <p className="mt-2 text-3xl font-bold text-[#65D69A]">
                            {totalAtivas}
                        </p>
                    </div>

                    <div className="rounded-xl border border-[#292F2A] bg-[#1A1E1A] p-5">
                        <p className="text-sm text-gray-400">
                            Subcategorias inativas
                        </p>
                        <p className="mt-2 text-3xl font-bold text-gray-400">
                            {totalInativas}
                        </p>
                    </div>
                </section>

                <section className="rounded-xl border border-[#292F2A] bg-[#1A1E1A] p-5 sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">
                            {editandoId
                                ? 'Editar subcategoria'
                                : 'Cadastrar subcategoria'}
                        </h2>

                        {editandoId && (
                            <button
                                type="button"
                                onClick={limparFormulario}
                                className="text-sm text-gray-400 hover:text-white"
                            >
                                Cancelar edição
                            </button>
                        )}
                    </div>

                    <form onSubmit={salvar} className="space-y-5">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="categoria_id"
                                    className="mb-2 block text-sm text-gray-300"
                                >
                                    Categoria *
                                </label>

                                <select
                                    id="categoria_id"
                                    value={categoriaId}
                                    onChange={(evento) =>
                                        setCategoriaId(evento.target.value)
                                    }
                                    required
                                    className="w-full rounded-lg border border-[#343B35] bg-[#101310] px-3 py-3 text-sm outline-none focus:border-[#65D69A]"
                                >
                                    <option value="">
                                        Selecione uma categoria
                                    </option>

                                    {categorias.map((categoria) => (
                                        <option
                                            key={categoria.id}
                                            value={categoria.id}
                                        >
                                            {categoria.nome}
                                            {!estaAtivo(categoria.ativo)
                                                ? ' (Inativa)'
                                                : ''}
                                        </option>
                                    ))}
                                </select>

                                {categorias.length === 0 && (
                                    <p className="mt-2 text-xs text-amber-300">
                                        Cadastre uma categoria antes de criar
                                        subcategorias.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor="nome"
                                    className="mb-2 block text-sm text-gray-300"
                                >
                                    Nome da subcategoria *
                                </label>

                                <input
                                    id="nome"
                                    type="text"
                                    value={nome}
                                    onChange={(evento) =>
                                        setNome(evento.target.value)
                                    }
                                    maxLength={100}
                                    required
                                    placeholder="Ex.: Hambúrgueres"
                                    className="w-full rounded-lg border border-[#343B35] bg-[#101310] px-3 py-3 text-sm outline-none focus:border-[#65D69A]"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="ordem"
                                    className="mb-2 block text-sm text-gray-300"
                                >
                                    Ordem de exibição
                                </label>

                                <input
                                    id="ordem"
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={ordem}
                                    onChange={(evento) =>
                                        setOrdem(evento.target.value)
                                    }
                                    className="w-full rounded-lg border border-[#343B35] bg-[#101310] px-3 py-3 text-sm outline-none focus:border-[#65D69A]"
                                />

                                <p className="mt-2 text-xs text-gray-500">
                                    Menores números aparecem primeiro.
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="descricao"
                                    className="mb-2 block text-sm text-gray-300"
                                >
                                    Descrição
                                </label>

                                <textarea
                                    id="descricao"
                                    value={descricao}
                                    onChange={(evento) =>
                                        setDescricao(evento.target.value)
                                    }
                                    maxLength={1000}
                                    rows={3}
                                    placeholder="Descrição opcional"
                                    className="w-full resize-y rounded-lg border border-[#343B35] bg-[#101310] px-3 py-3 text-sm outline-none focus:border-[#65D69A]"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="submit"
                                disabled={salvando || categorias.length === 0}
                                className="rounded-lg bg-[#65D69A] px-5 py-3 text-sm font-semibold text-[#101310] transition hover:bg-[#7BE5AC] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {salvando
                                    ? 'Salvando...'
                                    : editandoId
                                      ? 'Salvar alterações'
                                      : 'Cadastrar subcategoria'}
                            </button>

                            {editandoId && (
                                <button
                                    type="button"
                                    onClick={limparFormulario}
                                    className="rounded-lg border border-[#343B35] px-5 py-3 text-sm hover:bg-[#252B25]"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                <section className="overflow-hidden rounded-xl border border-[#292F2A] bg-[#1A1E1A]">
                    <div className="border-b border-[#292F2A] p-5">
                        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                            <h2 className="text-lg font-semibold">
                                Subcategorias cadastradas
                            </h2>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <select
                                    value={filtroCategoria}
                                    onChange={(evento) =>
                                        setFiltroCategoria(evento.target.value)
                                    }
                                    aria-label="Filtrar por categoria"
                                    className="rounded-lg border border-[#343B35] bg-[#101310] px-3 py-2.5 text-sm outline-none focus:border-[#65D69A]"
                                >
                                    <option value="">Todas as categorias</option>

                                    {categorias.map((categoria) => (
                                        <option
                                            key={categoria.id}
                                            value={categoria.id}
                                        >
                                            {categoria.nome}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={filtro}
                                    onChange={(evento) =>
                                        setFiltro(
                                            evento.target.value as FiltroStatus,
                                        )
                                    }
                                    aria-label="Filtrar por status"
                                    className="rounded-lg border border-[#343B35] bg-[#101310] px-3 py-2.5 text-sm outline-none focus:border-[#65D69A]"
                                >
                                    <option value="TODAS">Todos os status</option>
                                    <option value="ATIVA">Ativas</option>
                                    <option value="INATIVA">Inativas</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={() => void carregarDados()}
                                    disabled={carregando}
                                    className="rounded-lg border border-[#343B35] px-4 py-2.5 text-sm hover:bg-[#252B25] disabled:opacity-50"
                                >
                                    Atualizar
                                </button>
                            </div>
                        </div>
                    </div>

                    {carregando ? (
                        <div className="p-10 text-center text-sm text-gray-400">
                            Carregando subcategorias...
                        </div>
                    ) : subcategoriasFiltradas.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="text-gray-300">
                                Nenhuma subcategoria encontrada.
                            </p>
                            <p className="mt-2 text-sm text-gray-500">
                                Cadastre uma nova subcategoria ou altere os filtros.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-left text-sm">
                                <thead className="bg-[#141814] text-gray-400">
                                    <tr>
                                        <th className="px-5 py-4 font-medium">
                                            Ordem
                                        </th>
                                        <th className="px-5 py-4 font-medium">
                                            Subcategoria
                                        </th>
                                        <th className="px-5 py-4 font-medium">
                                            Categoria
                                        </th>
                                        <th className="px-5 py-4 font-medium">
                                            Descrição
                                        </th>
                                        <th className="px-5 py-4 font-medium">
                                            Status
                                        </th>
                                        <th className="px-5 py-4 text-right font-medium">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {subcategoriasFiltradas.map((subcategoria) => {
                                        const ativa = estaAtivo(subcategoria.ativo);

                                        return (
                                            <tr
                                                key={subcategoria.id}
                                                className="border-t border-[#292F2A] transition hover:bg-[#202520]"
                                            >
                                                <td className="px-5 py-4 text-gray-300">
                                                    {subcategoria.ordem}
                                                </td>

                                                <td className="px-5 py-4 font-medium">
                                                    {subcategoria.nome}
                                                </td>

                                                <td className="px-5 py-4 text-gray-300">
                                                    {subcategoria.categoria_nome ||
                                                        categorias.find(
                                                            (categoria) =>
                                                                categoria.id ===
                                                                subcategoria.categoria_id,
                                                        )?.nome ||
                                                        '—'}
                                                </td>

                                                <td className="max-w-xs px-5 py-4 text-gray-400">
                                                    <span className="block truncate">
                                                        {subcategoria.descricao ||
                                                            'Sem descrição'}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                                            ativa
                                                                ? 'bg-[#65D69A]/10 text-[#65D69A]'
                                                                : 'bg-gray-500/10 text-gray-400'
                                                        }`}
                                                    >
                                                        {ativa ? 'Ativa' : 'Inativa'}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                iniciarEdicao(
                                                                    subcategoria,
                                                                )
                                                            }
                                                            className="rounded-md border border-[#343B35] px-3 py-2 text-xs hover:border-[#65D69A] hover:text-[#65D69A]"
                                                        >
                                                            Editar
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void alterarStatus(
                                                                    subcategoria,
                                                                )
                                                            }
                                                            className={`rounded-md border px-3 py-2 text-xs ${
                                                                ativa
                                                                    ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
                                                                    : 'border-[#65D69A]/30 text-[#65D69A] hover:bg-[#65D69A]/10'
                                                            }`}
                                                        >
                                                            {ativa
                                                                ? 'Desativar'
                                                                : 'Ativar'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="border-t border-[#292F2A] px-5 py-4 text-xs text-gray-500">
                        Exibindo {subcategoriasFiltradas.length} de{' '}
                        {subcategorias.length} subcategoria(s).
                    </div>
                </section>
            </div>
        </main>
    );
}
